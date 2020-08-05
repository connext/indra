import {
  Opcode,
  ProtocolNames,
  ProtocolParams,
  IStoreService,
  ProtocolMessage,
  ProtocolRoles,
  ILoggerService,
  SetStateCommitmentJSON,
  ConditionalTransactionCommitmentJSON,
  AppInstanceJson,
  HexString,
} from "@connext/types";
import { stringify, logTime, toBN, getSignerAddressFromPublicIdentifier } from "@connext/utils";

import {
  stateChannelClassFromStoreByMultisig,
  getPureBytecode,
  generateProtocolMessageData,
  parseProtocolMessage,
} from "./utils";
import { StateChannel, AppInstance, FreeBalanceClass } from "../models";
import { Context, ProtocolExecutionFlow, PersistStateChannelType } from "../types";
import {
  SetStateCommitment,
  ConditionalTransactionCommitment,
  getSetStateCommitment,
} from "../ethereum";
import { getTokenBalanceDecrementForInstall } from "./install";
import { UNASSIGNED_SEQ_NO } from "../constants";

const protocol = ProtocolNames.sync;
const { IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL, OP_SIGN, OP_VALIDATE } = Opcode;

export const SYNC_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const { message, store, networks } = context;
    const log = context.log.newContext("CF-SyncProtocol");
    const start = Date.now();
    let substart = start;
    const { processID, params } = message.data;
    const loggerId = (params as ProtocolParams.Sync).multisigAddress || processID;
    log.info(`[${loggerId}] Initiation started: ${stringify(params, false, 0)}`);

    const {
      multisigAddress,
      responderIdentifier,
      initiatorIdentifier,
      appIdentityHash,
    } = params as ProtocolParams.Sync;

    const myIdentifier = initiatorIdentifier;
    const counterpartyIdentifier = responderIdentifier;

    // Send m1 to responder containing all information relevant for them
    // to:
    // - begin sync protocol
    // - determine if they need to sync from message data
    // - determine information we need to sync from message data
    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for sync");
    }

    const { contractAddresses, provider } = networks[preProtocolStateChannel.chainId];

    const syncDeterminationData = getSyncDeterminationData(preProtocolStateChannel);
    const { message: m2 } = (yield [
      IO_SEND_AND_WAIT,
      generateProtocolMessageData(counterpartyIdentifier, protocol, processID, 1, params!, {
        customData: { ...syncDeterminationData },
        prevMessageReceived: substart,
      }),
    ] as any)!;
    logTime(
      log,
      substart,
      `[${loggerId}] Received responder's m2: ${stringify((m2 as any).data.customData, false, 0)}`,
    );
    substart = Date.now();

    // Parse responder's m2. This should contain all of the information
    // we sent in m1 to determine if we should sync, in addition to all
    // the information they had for us to sync from
    const counterpartyData = parseProtocolMessage(m2).data.customData as SyncDeterminationData &
      SyncFromDataJson;

    // Determine how channel is out of sync, and get the info needed
    // for counterparty to sync (if any) to send
    const syncType = makeSyncDetermination(
      counterpartyData,
      preProtocolStateChannel,
      appIdentityHash,
      log,
    );
    log.info(`Initiator syncing with: ${stringify(syncType, true, 0)}`);
    const syncInfoForCounterparty = await getInfoForSync(syncType, preProtocolStateChannel, store);

    // Should already have information from counterparty needed to sync your
    // channel included in m2
    const { commitments, affectedApp, freeBalanceApp } = (m2! as ProtocolMessage).data
      .customData as SyncDeterminationData & SyncFromDataJson;

    const validCommitments = commitments && commitments.length > 0;
    if (syncType && !syncType.counterpartyIsBehind && !validCommitments && !!affectedApp) {
      throw new Error(
        `Need to sync from counterparty with ${
          syncType.type
        }, but did not receive any commitments in m2: ${stringify(m2, false, 0)}`,
      );
    }

    // Perform sync and generate persistType call for channel
    let postSyncStateChannel: StateChannel;
    if (!syncType || syncType.counterpartyIsBehind) {
      // We do not need to sync our channel
      postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());
    } else {
      // we should update our channel
      const param = affectedApp ? AppInstance.fromJson(affectedApp) : undefined;
      const [updatedChannel, persistType, verifiedCommitments, uninstalledApp] = await syncChannel(
        context,
        preProtocolStateChannel,
        syncType.type,
        commitments.map((c) =>
          !!c["contractAddresses"]
            ? ConditionalTransactionCommitment.fromJson(c as ConditionalTransactionCommitmentJSON)
            : SetStateCommitment.fromJson(c as SetStateCommitmentJSON),
        ),
        param || syncType.identityHash!,
        freeBalanceApp ? AppInstance.fromJson(freeBalanceApp) : undefined,
        log,
      );
      postSyncStateChannel = updatedChannel;
      const singleSignedCommitments = verifiedCommitments
        .filter((c) => {
          return c.signatures.filter((x) => !!x).length === 1;
        })
        .filter((x) => !!x) as SetStateCommitment[];

      if (syncType.type !== "takeAction" || singleSignedCommitments.length === 0) {
        // All other cases can be saved here because they do not require
        // special middleware access
        yield [
          PERSIST_STATE_CHANNEL,
          persistType,
          postSyncStateChannel,
          verifiedCommitments, // all signed commitments
          [param || uninstalledApp],
          // ^^ in the case of uninstall the affectedApp is undefined
        ];
      } else {
        // NOTE: must update single signed set state commitments here
        // instead of in the `syncChannel` function to properly access
        // middlewares
        if (singleSignedCommitments.length > 1) {
          throw new Error(
            `Cannot sync by more than one take action, and detected multiple single signed commitments. Use restore instead.`,
          );
        }
        const [commitment] = singleSignedCommitments;
        if (!commitment) {
          throw new Error(`Cannot find single signed commitment to update`);
        }
        const app = postSyncStateChannel.appInstances.get(commitment.appIdentityHash)!;

        // signature has been validated, add our signature
        // NOTE: iff commitment is single signed, we were the responder
        // in the take action commitment, and they initiated it
        const error = yield [
          OP_VALIDATE,
          ProtocolNames.takeAction,
          {
            params: {
              initiatorIdentifier: counterpartyIdentifier,
              responderIdentifier: myIdentifier,
              multisigAddress: postSyncStateChannel.multisigAddress,
              appIdentityHash: app.identityHash,
              action: affectedApp!.latestAction,
              stateTimeout: commitment.stateTimeout,
            },
            appInstance: app.toJson(),
            role: ProtocolRoles.responder,
          },
        ];
        if (!!error) {
          throw new Error(error);
        }

        // update the app
        postSyncStateChannel = postSyncStateChannel.setState(
          app,
          await app.computeStateTransition(
            getSignerAddressFromPublicIdentifier(initiatorIdentifier),
            affectedApp!.latestAction,
            provider,
            getPureBytecode(app.appDefinition, contractAddresses),
          ),
          commitment.stateTimeout,
        );

        // counterparty sig has already been asserted, sign commitment
        // and update channel
        const mySig = yield [OP_SIGN, commitment.hashToSign()];
        await commitment.addSignatures(
          mySig,
          commitment.signatures.find((x) => !!x),
        );

        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncAppInstances,
          postSyncStateChannel,
          commitment, // all signed commitments
          [affectedApp],
        ];

        logTime(log, substart, `[${loggerId}] Synced single signed app states with responder`);
      }
    }
    // After syncing channel, create list of proposal ids to send to
    // counterparty so rejections may be synced
    const mySyncedProposals = [...postSyncStateChannel.proposedAppInstances.keys()];

    const { message: m4 } = (yield [
      IO_SEND_AND_WAIT,
      generateProtocolMessageData(responderIdentifier, protocol, processID, 1, params!, {
        customData: {
          ...syncInfoForCounterparty,
          syncedProposals: mySyncedProposals,
        },
        prevMessageReceived: substart,
      }),
    ])!;
    logTime(
      log,
      substart,
      `[${loggerId}] Received responder's m4: ${stringify((m2 as any).data.customData, false, 0)}`,
    );
    substart = Date.now();

    // m4 includes the responders post-sync proposal ids. Handle all
    // unsynced rejections using these values
    const { syncedProposals: counterpartySyncedProposals } = parseProtocolMessage(m4).data
      .customData as { syncedProposals: string[] };

    // find any rejected proposals and update your channel
    const [postRejectChannel, rejected] = syncRejectedApps(
      postSyncStateChannel,
      counterpartySyncedProposals,
    );
    yield [
      PERSIST_STATE_CHANNEL,
      PersistStateChannelType.SyncRejectedProposals,
      postRejectChannel,
      [], // no commitments effected during proposal rejection
      rejected,
    ];
    logTime(log, start, `[${loggerId}] Initiation finished`);
  },
  1 /* Responding */: async function* (context: Context) {
    const { message: m1, store, networks, preProtocolStateChannel } = context;
    const { params, processID, customData } = m1.data;
    const log = context.log.newContext("CF-SyncProtocol");
    const start = Date.now();
    let substart = start;
    const loggerId = (params as ProtocolParams.Sync).multisigAddress || processID;
    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for sync");
    }

    const { contractAddresses, provider } = networks[preProtocolStateChannel.chainId];

    // Determine the sync type needed, and fetch any information the
    // counterparty would need to sync and send to them
    log.debug(`[${loggerId}] Response started with m1: ${stringify(customData, false, 0)}`);
    const {
      initiatorIdentifier,
      responderIdentifier,
      appIdentityHash,
    } = params as ProtocolParams.Sync;
    const myIdentifier = responderIdentifier;
    const counterpartyIdentifier = initiatorIdentifier;

    const syncType = makeSyncDetermination(
      customData as SyncDeterminationData,
      preProtocolStateChannel,
      appIdentityHash,
      log,
    );
    log.info(`Responder syncing with: ${stringify(syncType, true, 0)}`);
    const syncInfoForCounterparty = await getInfoForSync(syncType, preProtocolStateChannel, store);

    const { message: m3 } = (yield [
      IO_SEND_AND_WAIT,
      generateProtocolMessageData(counterpartyIdentifier, protocol, processID, 0, params!, {
        customData: {
          ...getSyncDeterminationData(preProtocolStateChannel),
          ...syncInfoForCounterparty,
        },
        prevMessageReceived: substart,
      }),
    ])!;
    logTime(
      log,
      substart,
      `[${loggerId}] Received initiator's m3: ${stringify((m3 as any).data.customData, false, 0)}`,
    );
    substart = Date.now();

    // Determine how channel is out of sync + sync channel
    const counterpartyData = parseProtocolMessage(m3).data.customData as {
      syncedProposals: string[];
    } & SyncFromDataJson;

    const {} = counterpartyData;
    let postSyncStateChannel: StateChannel;
    if (!syncType || syncType.counterpartyIsBehind) {
      // We do not need to sync our channel
      postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());
    } else {
      const { commitments, affectedApp, freeBalanceApp } = counterpartyData;
      // we should update our channel
      const param = affectedApp ? AppInstance.fromJson(affectedApp) : undefined;
      const [updatedChannel, persistType, verifiedCommitments, uninstalledApp] = await syncChannel(
        context,
        preProtocolStateChannel,
        syncType.type,
        commitments.map((c) =>
          !!(c as ConditionalTransactionCommitmentJSON).contractAddresses
            ? ConditionalTransactionCommitment.fromJson(c as ConditionalTransactionCommitmentJSON)
            : SetStateCommitment.fromJson(c as SetStateCommitmentJSON),
        ),
        param || syncType.identityHash!,
        freeBalanceApp ? AppInstance.fromJson(freeBalanceApp) : undefined,
        log,
      );
      postSyncStateChannel = updatedChannel;
      const singleSignedCommitments = verifiedCommitments.filter((c) => {
        return c.signatures.filter((x) => !!x).length === 1;
      }) as SetStateCommitment[];
      if (syncType.type !== "takeAction" || singleSignedCommitments.length === 0) {
        // All other cases can be saved here because they do not require
        // special middleware access
        yield [
          PERSIST_STATE_CHANNEL,
          persistType,
          postSyncStateChannel,
          verifiedCommitments, // all signed commitments
          [param || uninstalledApp],
          // ^^ in the case of uninstall the affectedApp is undefined
        ];
      } else {
        // NOTE: must update single signed set state commitments here
        // instead of in the `syncChannel` function to properly access
        // middlewares
        const singleSignedCommitments = verifiedCommitments.filter((c) => {
          return c.signatures.filter((x) => !!x).length === 1;
        }) as SetStateCommitment[];
        if (singleSignedCommitments.length > 1) {
          throw new Error(
            `Cannot sync by more than one take action, and detected multiple single signed commitments. Use restore instead.`,
          );
        }
        const [commitment] = singleSignedCommitments;
        if (!commitment) {
          throw new Error(`Cannot find single signed commitment to update`);
        }
        const app = postSyncStateChannel.appInstances.get(commitment.appIdentityHash)!;

        // signature has been validated, add our signature
        // NOTE: iff commitment is single signed, we were the responder
        // in the take action commitment, and they initiated it
        const error = yield [
          OP_VALIDATE,
          ProtocolNames.takeAction,
          {
            params: {
              initiatorIdentifier: counterpartyIdentifier,
              responderIdentifier: myIdentifier,
              multisigAddress: postSyncStateChannel.multisigAddress,
              appIdentityHash: app.identityHash,
              action: affectedApp!.latestAction,
              stateTimeout: commitment.stateTimeout,
            },
            appInstance: app.toJson(),
            role: ProtocolRoles.responder,
          },
        ];
        if (!!error) {
          throw new Error(error);
        }

        // update the app
        postSyncStateChannel = postSyncStateChannel.setState(
          app,
          await app.computeStateTransition(
            getSignerAddressFromPublicIdentifier(initiatorIdentifier),
            affectedApp!.latestAction,
            provider,
            getPureBytecode(app.appDefinition, contractAddresses),
          ),
          commitment.stateTimeout,
        );

        // counterparty sig has already been asserted, sign commitment
        // and update channel
        const mySig = yield [OP_SIGN, commitment.hashToSign()];
        await commitment.addSignatures(
          mySig,
          commitment.signatures.find((x) => !!x),
        );

        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncAppInstances,
          postSyncStateChannel,
          commitment, // all signed commitments
          [affectedApp],
        ];

        logTime(log, substart, `[${loggerId}] Synced single signed app states with responder`);
      }
    }

    // After syncing channel, create list of proposal ids to send to
    // counterparty so rejections may be synced
    const [postRejectChannel, rejected] = syncRejectedApps(
      postSyncStateChannel,
      counterpartyData.syncedProposals,
    );

    yield [
      PERSIST_STATE_CHANNEL,
      PersistStateChannelType.SyncRejectedProposals,
      postRejectChannel,
      [], // no commitments effected during proposal rejection
      rejected,
    ];
    logTime(log, substart, `[${loggerId}] Synced rejected apps with initiator`);
    substart = Date.now();

    // send counterparty final list of proposal IDs
    yield [
      IO_SEND,
      generateProtocolMessageData(
        initiatorIdentifier,
        protocol,
        processID,
        UNASSIGNED_SEQ_NO,
        params!,
        {
          customData: {
            syncedProposals: [...postRejectChannel.proposedAppInstances.keys()],
          },
          prevMessageReceived: substart,
        },
      ),
      postSyncStateChannel,
    ];
    logTime(log, start, `[${loggerId}] Response finished`);
  },
};

// This function should collect all information from our store and
// channel necessary for the counterparty to determine if and
// how they need to sync. To determine whether or not counterparties
// have gotten out of sync, you need the following information:
// 1. Free balance nonce (updated on uninstall, install)
// 2. Channel num proposed apps (updated on propose)
// 3. Channel proposal info inc. id + nonce (updated on propose,
//    reject, install)
// 3. Channel app info inc. id + nonce (updated on install, takeAction,
//    uninstall)
type SyncDeterminationData = {
  freeBalanceVersionNumber: number;
  numProposedApps: number;
  proposals: { identityHash: string; appSeqNo: number }[];
  apps: { identityHash: string; latestVersionNumber: number }[];
};
function getSyncDeterminationData(preProtocolStateChannel: StateChannel): SyncDeterminationData {
  return {
    freeBalanceVersionNumber: preProtocolStateChannel.freeBalance.latestVersionNumber,
    numProposedApps: preProtocolStateChannel.numProposedApps,
    proposals: [...preProtocolStateChannel.proposedAppInstances.values()].map((app) => {
      return {
        identityHash: app.identityHash,
        appSeqNo: app.appSeqNo,
      };
    }),
    apps: [...preProtocolStateChannel.appInstances.values()].map((app) => {
      return {
        identityHash: app.identityHash,
        latestVersionNumber: app.latestVersionNumber,
      };
    }),
  };
}

// This function should determine if/how the channel is out of sync when
// given SyncDeterminationData from your counterparty. It is important
// to note that this will NOT handle cases where a channel is out of
// sync to do a rejected proposal. Instead, it will verify that the channel
// is out of sync by only one other type of state transition, and return
// that information. After syncing with this transition, rejected proposals
// should *always* be synced between participants.
const { sync, setup, ...SyncableProtocols } = ProtocolNames;
type SyncDetermination = {
  type: keyof typeof SyncableProtocols;
  counterpartyIsBehind: boolean;
  identityHash?: string; // hash of app or proposal thats out of sync
  // in the case of free balance sync issues, this is the hash of the
  // installed or uninstalled app
};
function makeSyncDetermination(
  counterpartyData: SyncDeterminationData | undefined, // just cus types are sketch
  myChannel: StateChannel,
  appIdentityHash: HexString | undefined, // from our protocol params
  log: ILoggerService,
): SyncDetermination | undefined {
  // Get information from counterparty, and make sure it is defined.
  const { freeBalanceVersionNumber, numProposedApps, proposals, apps } = counterpartyData || {};
  // use helper function in case the numbers are provided and 0
  const exists = (val: any) => {
    return val !== undefined && val !== null;
  };
  if (
    !exists(freeBalanceVersionNumber) ||
    !exists(proposals) ||
    !exists(apps) ||
    !exists(numProposedApps)
  ) {
    throw new Error(
      `Cannot make sync determination. Missing information from counterparty, got: ${stringify(
        counterpartyData,
        true,
        0,
      )}`,
    );
  }

  // Important to "prioritize" channel sync issues. The top most priority
  // is the discrepancy between free balance versions. This happens when
  // an app is installed or uninstalled *only*
  if (freeBalanceVersionNumber !== myChannel.freeBalance.latestVersionNumber) {
    // should only be able to sync from at most one of these transitions
    if (Math.abs(freeBalanceVersionNumber! - myChannel.freeBalance.latestVersionNumber) !== 1) {
      throw new Error(
        `Cannot sync free balance apps by more than one transition. Our nonce: ${myChannel.freeBalance.latestVersionNumber}, theirs: ${freeBalanceVersionNumber}`,
      );
    }

    let counterpartyIsBehind: boolean;
    let type: keyof typeof SyncableProtocols;
    if (myChannel.freeBalance.latestVersionNumber > freeBalanceVersionNumber!) {
      // we are ahead, our apps are the source of truth
      counterpartyIsBehind = true;
      // if we have more apps, counterparty missed install
      type = myChannel.appInstances.size > apps!.length ? "install" : "uninstall";
    } else {
      // we are behind, their apps are the source of truth
      counterpartyIsBehind = false;
      // if we have more apps, we missed install
      type = apps!.length > myChannel.appInstances.size ? "install" : "uninstall";
    }

    const myApps = [...myChannel.appInstances.values()].map((app) => app.identityHash);
    const theirApps = apps!.map((app) => app.identityHash);
    const unsynced = myApps
      .filter((x) => !(theirApps || []).includes(x))
      .concat(theirApps.filter((x) => !(myApps || []).includes(x)));
    if (!unsynced || unsynced.length !== 1) {
      throw new Error(
        `Could not find an unsynced app, or there was more than one. My apps: ${stringify(
          myApps,
          true,
          0,
        )}, theirs: ${stringify(theirApps, true, 0)}`,
      );
    }

    return {
      type,
      counterpartyIsBehind,
      identityHash: unsynced[0],
    };
  }

  // Free balance apps are now in sync, so we must determine if the
  // proposals are in sync. Evaluate if a propose protocol was the cause of
  // the sync issues by using the `numProposedApps`. Both `install` and
  // `rejectInstall` alter the proposal array within a channel, but only errors
  // from a propose protocol would result in `numProposedApps` issue
  if (numProposedApps !== myChannel.numProposedApps) {
    // should only be able to sync from at most one of these transitions
    if (Math.abs(numProposedApps! - myChannel.numProposedApps) !== 1) {
      throw new Error(
        `Cannot sync proposed apps by more than one transition. Our nonce: ${myChannel.numProposedApps}, theirs: ${numProposedApps}`,
      );
    }

    if (myChannel.numProposedApps > numProposedApps!) {
      const myProposals = [...myChannel.proposedAppInstances.values()].map((proposal) => {
        return { appSeqNo: proposal.appSeqNo, identityHash: proposal.identityHash };
      });
      const proposal = myProposals.find((p) => p.appSeqNo === myChannel.numProposedApps);
      if (!proposal) {
        log.error(
          `Could not find out of sync proposal (counterparty behind). My proposals: ${stringify(
            myProposals,
            true,
            0,
          )}, counterparty proposals: ${stringify(proposals, true, 0)}.`,
        );
      }
      return {
        counterpartyIsBehind: true,
        type: "propose",
        identityHash: proposal?.identityHash,
      };
    } else if (myChannel.numProposedApps < numProposedApps!) {
      // we need sync from counterparty
      const proposal = proposals!.find((p) => p.appSeqNo === numProposedApps);
      if (!proposal) {
        log.error(
          `Could not find out of sync proposal (counterparty ahead). My proposals: ${stringify([
            ...myChannel.proposedAppInstances.keys(),
            true,
            0,
          ])}, counterparty proposals: ${stringify(proposals, true, 0)}`,
        );
      }
      return {
        counterpartyIsBehind: false,
        type: "propose",
        identityHash: proposal?.identityHash,
      };
    } else {
      throw new Error("Something is off -- not gt or lt and already checked for eq...");
    }
  }

  // Now determine if any apps are out of sync from errors in the `takeAction`
  // protocol. This would come from a discrepancy in app version numbers.
  // To get to this point in the function, we know that the channel fell out of
  // sync while taking action on the app. This means that we *know* this app has
  // to be synced
  const sameApps = myChannel.appInstances.size === apps!.length;
  if (!appIdentityHash || sameApps) {
    // assume that there is no problem with the apps
    // while this is not technically true, we know that if the appId was not
    // provided and we are syncing on error, the retry of the fn should work
    return undefined;
  }

  const myApp = myChannel.appInstances.get(appIdentityHash);
  if (!myApp) {
    throw new Error(
      `Counterparty channel has record of app we do not (${appIdentityHash}), despite free balance nonces being in sync. Our apps: ${stringify(
        [...myChannel.appInstances.keys()],
        true,
        0,
      )}, their apps: ${stringify(apps, true, 0)}`,
    );
  }

  const counterpartyInfo = apps!.find((app) => app.identityHash === appIdentityHash);
  if (!counterpartyInfo) {
    throw new Error(
      `Our channel has record of app counterparty does not, despite free balance nonces being in sync. Our apps: ${stringify(
        [...myChannel.appInstances.keys()],
        true,
        0,
      )}, their apps: ${stringify(apps, true, 0)}`,
    );
  }

  if (counterpartyInfo.latestVersionNumber === myApp.latestVersionNumber) {
    // App + channel are not out of sync, return undefined
    return undefined;
  }

  return {
    type: "takeAction",
    counterpartyIsBehind: counterpartyInfo.latestVersionNumber < myApp.latestVersionNumber,
    identityHash: appIdentityHash,
  };
  // TODO: should eventually allow for syncing of multiple apps, regardless of
  // what was passed into the sync protocol params
}

// what gets passed over the wire
type SyncFromDataJson = {
  commitments: (SetStateCommitmentJSON | ConditionalTransactionCommitmentJSON)[];
  affectedApp?: AppInstanceJson; // not provided iff syncing from uninstall
  freeBalanceApp?: AppInstanceJson; // provided iff syncing from uninstall
};

async function getInfoForSync(
  syncType: SyncDetermination | undefined,
  myChannel: StateChannel,
  store: IStoreService,
): Promise<SyncFromDataJson> {
  const emptyObj = {
    commitments: [],
  }; // used if no data needed from / available for counterparty
  if (!syncType) {
    // Means that channels are not actually out of sync, return empty object
    return emptyObj;
  }

  const { counterpartyIsBehind, identityHash, type } = syncType;
  if (!counterpartyIsBehind) {
    // Means that counterparty needs to give us info, return empty obj
    return emptyObj;
  }

  // Get commitments and object for effected app
  const conditional = await store.getConditionalTransactionCommitment(identityHash!);
  const [setState] = await store.getSetStateCommitments(identityHash!);

  // Get data for counterparty dep. on type
  switch (type) {
    case "propose": {
      // send counterparty:
      // - set state commitment for unsynced proposal
      // - conditional commitment for unsynced proposal
      // - unsynced proposal obj
      const proposal = myChannel.proposedAppInstances.get(identityHash!);
      if (!setState || !conditional || !proposal) {
        return { commitments: [], affectedApp: undefined };
      }
      return {
        commitments: [setState, conditional],
        affectedApp: proposal,
      };
    }
    case "install": {
      // send counterparty:
      // - set state commitment for free balance
      // - unsynced app obj
      const app = myChannel.appInstances.get(identityHash!);
      const [fbCommitment] = await store.getSetStateCommitments(myChannel.freeBalance.identityHash);
      if (!fbCommitment) {
        throw new Error(
          `Failed to retrieve uninstall sync info for counterparty for: ${identityHash}`,
        );
      }
      if (!fbCommitment || !app) {
        // both may be undefined IFF a proposal was rejected
        throw new Error(
          `Failed to retrieve install sync info for counterparty for: ${identityHash}. Found app: ${!!app}, found commitment: ${!!fbCommitment}`,
        );
      }
      return {
        commitments: [fbCommitment],
        affectedApp: app.toJson(),
      };
    }
    case "takeAction": {
      // send counterparty:
      // - set state commitment for app
      // - unsynced app obj
      const app = myChannel.appInstances.get(identityHash!);
      if (!setState || !app) {
        throw new Error(
          `Failed to retrieve takeAction sync info for counterparty for: ${identityHash}`,
        );
      }
      return {
        commitments: [setState],
        affectedApp: app.toJson(),
      };
    }
    case "uninstall": {
      // send counterparty:
      // - set state commitment for free balance
      // - latest free balance app (so they dont have to compute with evm)
      const [fbCommitment] = await store.getSetStateCommitments(myChannel.freeBalance.identityHash);
      if (!fbCommitment) {
        throw new Error(
          `Failed to retrieve uninstall sync info for counterparty for: ${identityHash}`,
        );
      }
      return {
        commitments: [fbCommitment],
        freeBalanceApp: myChannel.freeBalance.toJson(),
      };
    }
    default: {
      const c: never = type;
      throw new Error(`Unrecognized sync type: ${c}`);
    }
  }
}

// Updates the channel with counterparty information
// Returns the updated channel, the persist type, and
// the signed commitments needed to either save to the store
// or validate single signed commitments
async function syncChannel(
  context: Context,
  myChannel: StateChannel,
  type: keyof typeof SyncableProtocols,
  commitments: (SetStateCommitment | ConditionalTransactionCommitment)[],
  affectedApp: AppInstance | string,
  freeBalanceApp: AppInstance | undefined,
  log: ILoggerService,
): Promise<
  [
    StateChannel,
    PersistStateChannelType,
    (SetStateCommitment | ConditionalTransactionCommitment)[],
    AppInstance?,
  ] // app inc. iff uninstalled
> {
  // Verify signatures on any provided commitments
  await Promise.all(commitments.map((c) => c.assertSignatures()));

  // Update channel
  let updatedChannel: StateChannel;
  let persistType: PersistStateChannelType;
  let verifiedCommitments: (SetStateCommitment | ConditionalTransactionCommitment)[];
  let uninstalledApp: AppInstance | undefined = undefined;
  // ^^ commitments in order expected by store middleware
  // that we have verified are contextually correct and have our sigs on them

  switch (type) {
    case "propose": {
      if (typeof affectedApp === "string") {
        throw new Error(
          `Received valid commitments, but no affected app for proposal sync of channel ${myChannel.multisigAddress}`,
        );
      }

      if (affectedApp) {
        // should have received a set state and conditional tx as the commitments
        // and both should correspond to the effected app
        const setState = commitments.find(
          (c) =>
            c.appIdentityHash === affectedApp.identityHash &&
            !!c["versionNumber"] &&
            (c as SetStateCommitment).versionNumber.eq(affectedApp.latestVersionNumber),
        );
        const conditional = commitments.find(
          (c) =>
            c.appIdentityHash === affectedApp.identityHash &&
            !!c["freeBalanceAppIdentityHash"] &&
            (c as ConditionalTransactionCommitment).freeBalanceAppIdentityHash ===
              myChannel.freeBalance.identityHash,
        );
        if (!setState || !conditional) {
          throw new Error(
            "Verified commitments are signed, but could not find one that corresponds to the effected app when syncing channel from proposal",
          );
        }
        // set return values
        verifiedCommitments = [setState, conditional];
        updatedChannel = myChannel.addProposal(affectedApp.toJson());
      } else {
        verifiedCommitments = [];
        updatedChannel = myChannel.incrementNumProposedApps();
      }

      persistType = PersistStateChannelType.SyncProposal;
      break;
    }

    case "install": {
      if (typeof affectedApp === "string") {
        throw new Error(
          `Received valid commitments, but no effected app for install sync of channel ${myChannel.multisigAddress}`,
        );
      }
      persistType = PersistStateChannelType.SyncInstall;
      // calculate the new channel after installation
      // NOTE: this will NOT fail if we do not have
      updatedChannel = myChannel.installApp(
        affectedApp,
        getTokenBalanceDecrementForInstall(myChannel, affectedApp),
      );
      // verify the expected commitment is included
      const generatedSetState = getSetStateCommitment(
        context.networks[myChannel.chainId],
        updatedChannel.freeBalance,
      );
      const setState = commitments.find((c) => c.hashToSign === generatedSetState.hashToSign);
      if (!setState) {
        throw new Error(
          `Could not find commitment matching expected to sync channel with install of ${affectedApp.identityHash}`,
        );
      }
      verifiedCommitments = [setState];
      break;
    }

    case "takeAction": {
      if (typeof affectedApp === "string") {
        throw new Error(
          `Received valid commitments, but no affected app for take action sync of channel ${myChannel.multisigAddress}`,
        );
      }
      const app = myChannel.appInstances.get(affectedApp.identityHash);
      if (!app) {
        throw new Error(`Channel has no record of out of sync app: ${affectedApp.identityHash}`);
      }
      const commitment = commitments.find(
        (c) => c.appIdentityHash === affectedApp.identityHash,
      ) as SetStateCommitment;
      // if the commitment is single signed, return only the single signed
      // commitment without making any updates to the channel
      if (commitment.signatures.filter((x) => !!x).length === 1) {
        updatedChannel = myChannel;
        verifiedCommitments = [commitment];
      } else {
        updatedChannel = myChannel.setState(
          app,
          affectedApp.latestState,
          toBN(affectedApp.stateTimeout),
        );
        const updatedApp = updatedChannel.appInstances.get(affectedApp.identityHash);
        if (updatedApp?.hashOfLatestState !== commitment.toJson().appStateHash) {
          throw new Error(`Provided set state commitment for app does not match expected`);
        }
        verifiedCommitments = [commitment];
      }
      persistType = PersistStateChannelType.SyncAppInstances;
      break;
    }

    case "uninstall": {
      if (typeof affectedApp !== "string") {
        throw new Error(
          `Expected counterparty to return a string representing the uninstalled appId, got: ${stringify(
            affectedApp,
            true,
            0,
          )}`,
        );
      }
      if (!freeBalanceApp) {
        throw new Error(
          `Did not get updated free balance app from counterparty. NOTE: we should re-compute the state-transition here, but overall this is indicative of a different problem`,
        );
      }
      // verify the expected commitment is included
      const setState = commitments.find((c) => {
        const json = c.toJson();
        const isSetState = !!json["appStateHash"];
        if (!isSetState) {
          return false;
        }
        return (
          toBN((json as SetStateCommitmentJSON).versionNumber).eq(
            freeBalanceApp.latestVersionNumber,
          ) && json.appIdentityHash === freeBalanceApp.identityHash
        );
      });
      if (!setState) {
        throw new Error(
          `Could not find commitment matching expected to sync channel with uninstall of ${affectedApp}`,
        );
      }
      verifiedCommitments = [setState];
      updatedChannel = myChannel
        .removeAppInstance(affectedApp)
        .setFreeBalance(FreeBalanceClass.fromAppInstance(freeBalanceApp));
      persistType = PersistStateChannelType.SyncUninstall;
      uninstalledApp = myChannel.appInstances.get(affectedApp);
      break;
    }

    default: {
      const c: never = type;
      throw new Error(`Could not create updated channel, unrecognized sync type: ${c}`);
    }
  }

  return [updatedChannel, persistType, verifiedCommitments, uninstalledApp];
}

function syncRejectedApps(
  myChannel: StateChannel,
  counterpartyProposals: string[] = [],
): [StateChannel, AppInstance[]] {
  const myProposals = [...myChannel.proposedAppInstances.keys()];

  // find any rejected proposals and update your channel
  const rejectedIds = myProposals
    .filter((x) => !counterpartyProposals.includes(x))
    .concat(counterpartyProposals.filter((x) => !myProposals.includes(x)));

  let postRejectChannel = StateChannel.fromJson(myChannel.toJson());
  const rejected: AppInstance[] = [];
  rejectedIds.forEach((identityHash) => {
    const proposal = postRejectChannel.proposedAppInstances.get(identityHash);
    if (!proposal) {
      return;
    }
    rejected.push(AppInstance.fromJson(proposal));
    postRejectChannel = postRejectChannel.removeProposal(identityHash);
  });
  return [postRejectChannel, rejected];
}
