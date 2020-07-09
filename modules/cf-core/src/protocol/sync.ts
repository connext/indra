import {
  Opcode,
  ProtocolNames,
  ProtocolParams,
  IStoreService,
  ProtocolMessage,
  ProtocolRoles,
  ILoggerService,
  SetStateCommitmentJSON,
} from "@connext/types";
import { Context, ProtocolExecutionFlow, PersistStateChannelType } from "../types";
import { stringify, logTime, toBN } from "@connext/utils";
import { stateChannelClassFromStoreByMultisig, getPureBytecode } from "./utils";
import { StateChannel, AppInstance, FreeBalanceClass } from "../models";
import {
  SetStateCommitment,
  ConditionalTransactionCommitment,
  getSetStateCommitment,
  getConditionalTransactionCommitment,
} from "../ethereum";
import { getTokenBalanceDecrementForInstall } from "./install";
import { UNASSIGNED_SEQ_NO } from "../constants";

const protocol = ProtocolNames.sync;
const { IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL, OP_SIGN, OP_VALIDATE } = Opcode;

export const SYNC_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    // Parse information from context
    const {
      message,
      store,
      network: { contractAddresses, provider },
    } = context;
    const log = context.log.newContext("CF-SyncProtocol");
    const start = Date.now();
    let substart = start;
    const { processID, params } = message;
    const loggerId = (params as ProtocolParams.Sync).multisigAddress || processID;
    log.info(`[${loggerId}] Initiation started: ${stringify(params)}`);
    const {
      multisigAddress,
      responderIdentifier,
      initiatorIdentifier,
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
    const syncDeterminationData = getSyncDeterminationData(preProtocolStateChannel);
    const m2 = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        seq: 1,
        to: counterpartyIdentifier,
        customData: { ...syncDeterminationData },
      },
    ];
    log.info(`Initiation continuing with m2: ${stringify((m2 as any).data.customData)}`);
    logTime(log, substart, `[${loggerId}] Received responder's m2`);
    substart = Date.now();

    // Parse responder's m2. This should contain all of the information
    // we sent in m1 to determine if we should sync, in addition to all
    // the information they had for us to sync from
    const counterpartyData = (m2! as ProtocolMessage).data.customData as SyncDeterminationData &
      SyncFromData;

    // Determine how channel is out of sync, and get the info needed
    // for counterparty to sync (if any) to send
    const syncType = makeSyncDetermination(counterpartyData, preProtocolStateChannel, log);
    log.info(`Initiator syncing with: ${stringify(syncType)}`);
    const syncInfoForCounterparty = await getInfoForSync(syncType, preProtocolStateChannel, store);

    // Should already have information from counterparty needed to sync your
    // channel included in m2
    const { commitments, affectedApp, freeBalanceApp } = (m2! as ProtocolMessage).data
      .customData as SyncDeterminationData & SyncFromData;

    const validCommitments = commitments && commitments.length > 0;
    if (syncType && !syncType.counterpartyIsBehind && !validCommitments && !!affectedApp) {
      throw new Error(
        `Need to sync from counterparty with ${
          syncType.type
        }, but did not receive any commitments in m2: ${stringify(m2)}`,
      );
    }

    // Perform sync and generate persistType call for channel
    let postSyncStateChannel: StateChannel;
    if (!syncType || syncType.counterpartyIsBehind) {
      // We do not need to sync our channel
      postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());
    } else {
      // we should update our channel
      const [updatedChannel, persistType, verifiedCommitments] = await syncChannel(
        context,
        preProtocolStateChannel,
        syncType.type,
        commitments,
        affectedApp || syncType.identityHash!,
        freeBalanceApp,
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
          [affectedApp || { identityHash: syncType.identityHash }],
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
        const app = postSyncStateChannel.appInstances.get(
          singleSignedCommitments[0].appIdentityHash,
        )!;

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
              stateTimeout: singleSignedCommitments[0].stateTimeout,
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
            affectedApp!.latestAction,
            provider,
            getPureBytecode(app.appDefinition, contractAddresses),
          ),
          singleSignedCommitments[0].stateTimeout,
        );

        // counterparty sig has already been asserted, sign commitment
        // and update channel
        const mySig = yield [OP_SIGN, singleSignedCommitments[0].hashToSign()];
        await singleSignedCommitments[0].addSignatures(
          mySig,
          singleSignedCommitments[0].signatures.find((x) => !!x),
        );

        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncAppInstances,
          postSyncStateChannel,
          singleSignedCommitments[0], // all signed commitments
          [affectedApp],
        ];

        logTime(log, substart, `[${loggerId}] Synced single signed app states with responder`);
      }
    }
    // After syncing channel, create list of proposal ids to send to
    // counterparty so rejections may be synced
    const mySyncedProposals = [...postSyncStateChannel.proposedAppInstances.keys()];

    const m4 = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        seq: 2,
        to: responderIdentifier,
        customData: {
          ...syncInfoForCounterparty,
          syncedProposals: mySyncedProposals,
        },
      },
    ];
    log.info(`Initiation continuing with m4: ${stringify((m2 as any).data.customData)}`);
    logTime(log, substart, `[${loggerId}] Received responder's m4`);
    substart = Date.now();

    // m4 includes the responders post-sync proposal ids. Handle all
    // unsynced rejections using these values
    const { syncedProposals: counterpartySyncedProposals } = (m4! as ProtocolMessage).data
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
  },
  1 /* Responding */: async function* (context: Context) {
    const {
      message: m1,
      store,
      network: { contractAddresses, provider },
      preProtocolStateChannel,
    } = context;
    const { params, processID } = m1;
    const log = context.log.newContext("CF-SyncProtocol");
    const start = Date.now();
    let substart = start;
    const loggerId = (params as ProtocolParams.Sync).multisigAddress || processID;
    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for sync");
    }
    log.info(`[${loggerId}] Response started ${stringify(params)}`);
    const { responderIdentifier, initiatorIdentifier } = params as ProtocolParams.Sync;
    const counterpartyIdentifier = initiatorIdentifier;
    const myIdentifier = responderIdentifier;

    // Determine the sync type needed, and fetch any information the
    // counterparty would need to sync and send to them
    log.info(`Response started with m1: ${stringify(m1.customData)}`);
    const syncType = makeSyncDetermination(
      m1.customData as SyncDeterminationData,
      preProtocolStateChannel,
      log,
    );
    log.info(`Responder syncing with: ${stringify(syncType)}`);
    const syncInfoForCounterparty = await getInfoForSync(syncType, preProtocolStateChannel, store);

    const m3 = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        seq: 1,
        to: counterpartyIdentifier,
        customData: {
          ...getSyncDeterminationData(preProtocolStateChannel),
          ...syncInfoForCounterparty,
        },
      },
    ];
    logTime(log, substart, `[${loggerId}] Received initiator's m3`);
    substart = Date.now();
    log.info(`Response continuing with m3: ${stringify((m3 as any).data.customData)}`);

    // Determine how channel is out of sync + sync channel
    const counterpartyData = (m3! as ProtocolMessage).data.customData as {
      syncedProposals: string[];
    } & SyncFromData;

    const {} = counterpartyData;
    let postSyncStateChannel: StateChannel;
    if (!syncType || syncType.counterpartyIsBehind) {
      // We do not need to sync our channel
      postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());
    } else {
      const { commitments, affectedApp, freeBalanceApp } = counterpartyData;
      // we should update our channel
      const [updatedChannel, persistType, verifiedCommitments] = await syncChannel(
        context,
        preProtocolStateChannel,
        syncType.type,
        commitments,
        affectedApp || syncType.identityHash!,
        freeBalanceApp,
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
          [affectedApp || { identityHash: syncType.identityHash }],
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
        const app = postSyncStateChannel.appInstances.get(
          singleSignedCommitments[0].appIdentityHash,
        )!;

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
              stateTimeout: singleSignedCommitments[0].stateTimeout,
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
            affectedApp!.latestAction,
            provider,
            getPureBytecode(app.appDefinition, contractAddresses),
          ),
          singleSignedCommitments[0].stateTimeout,
        );

        // counterparty sig has already been asserted, sign commitment
        // and update channel
        const mySig = yield [OP_SIGN, singleSignedCommitments[0].hashToSign()];
        await singleSignedCommitments[0].addSignatures(
          mySig,
          singleSignedCommitments[0].signatures.find((x) => !!x),
        );

        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncAppInstances,
          postSyncStateChannel,
          singleSignedCommitments[0], // all signed commitments
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
      {
        protocol,
        processID,
        params,
        seq: UNASSIGNED_SEQ_NO,
        to: initiatorIdentifier,
        customData: {
          syncedProposals: [...postRejectChannel.proposedAppInstances.keys()],
        },
      },
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
      .filter((x) => !theirApps.includes(x))
      .concat(theirApps.filter((x) => !myApps.includes(x)));
    if (unsynced.length !== 1) {
      throw new Error(
        `Could not find an unsynced app, or there was more than one. My apps: ${stringify(
          myApps,
        )}, theirs: ${stringify(theirApps)}`,
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
          )}, counterparty proposals: ${stringify(proposals)}.`,
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
          ])}, counterparty proposals: ${stringify(proposals)}`,
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
  // protocol. This would come from a discrepancy in app version numbers
  let outOfSync = false;
  let counterpartyIsBehind: boolean = false;
  let identityHash: string = "";
  apps!.forEach((app) => {
    if (!myChannel.appInstances.has(app.identityHash)) {
      throw new Error(
        `Counterparty channel has record of app we do not, despite free balance nonces being in sync. App: ${app.identityHash}`,
      );
    }
    if (outOfSync) {
      return;
    }
    const myNonce = myChannel.appInstances.get(app.identityHash)!.versionNumber;
    if (myNonce === app.latestVersionNumber) {
      return;
    }
    // make sure you only sync by one action taken
    if (Math.abs(app.latestVersionNumber - myNonce) !== 1) {
      throw new Error(
        `Cannot sync app ${app.identityHash} by more than one action transition. Our nonce: ${myNonce}, counterparty: ${app.latestVersionNumber}`,
      );
    }
    outOfSync = true;
    counterpartyIsBehind = myNonce > app.latestVersionNumber;
    identityHash = app.identityHash;
  });

  if (outOfSync) {
    return {
      type: "takeAction",
      counterpartyIsBehind,
      identityHash,
    };
  }

  // Channel is not out of sync, return undefined
  return undefined;
}

type SyncFromData = {
  commitments: (SetStateCommitment | ConditionalTransactionCommitment)[];
  affectedApp?: AppInstance; // not provided iff syncing from uninstall
  freeBalanceApp?: AppInstance; // provided iff syncing from uninstall
};
async function getInfoForSync(
  syncType: SyncDetermination | undefined,
  myChannel: StateChannel,
  store: IStoreService,
): Promise<SyncFromData> {
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
        commitments: [
          setState && SetStateCommitment.fromJson(setState),
          conditional && ConditionalTransactionCommitment.fromJson(conditional),
        ],
        affectedApp: proposal && AppInstance.fromJson(proposal),
      };
    }
    case "install": {
      // send counterparty:
      // - set state commitment for free balance
      // - unsynced app obj
      const app = myChannel.appInstances.get(identityHash!);
      if (!setState || !app) {
        throw new Error(
          `Failed to retrieve install sync info for counterparty for: ${identityHash}`,
        );
      }
      return {
        commitments: [SetStateCommitment.fromJson(setState)],
        affectedApp: app,
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
        commitments: [SetStateCommitment.fromJson(setState)],
        affectedApp: app,
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
        commitments: [SetStateCommitment.fromJson(fbCommitment)],
        freeBalanceApp: myChannel.freeBalance,
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
  commitmentObjs: (SetStateCommitment | ConditionalTransactionCommitment)[],
  affectedApp: AppInstance | string,
  freeBalanceApp: AppInstance | undefined,
  log: ILoggerService,
): Promise<
  [StateChannel, PersistStateChannelType, (SetStateCommitment | ConditionalTransactionCommitment)[]]
> {
  // Properly assert that the commitment is a commitment object
  // (this should be fixed, but)
  const commitments = commitmentObjs.map((c: any) => {
    const hasFn = !!c["toJson"] && typeof c["toJson"] == "function";
    const isConditional = !!c["contractAddresses"];
    // assume its already the correct type
    return isConditional
      ? ConditionalTransactionCommitment.fromJson(hasFn ? c.toJson() : c)
      : SetStateCommitment.fromJson(hasFn ? c.toJson() : c);
  });
  // Verify signatures on any provided commitments
  await Promise.all(commitments.map((c) => c.assertSignatures()));

  // Update channel
  let updatedChannel: StateChannel;
  let persistType: PersistStateChannelType;
  let verifiedCommitments: (SetStateCommitment | ConditionalTransactionCommitment)[];
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
        const generatedSetState = getSetStateCommitment(context, affectedApp);
        const generatedConditional = getConditionalTransactionCommitment(
          context,
          myChannel,
          affectedApp,
        );
        const setState = commitments.find((c) => c.hashToSign === generatedSetState.hashToSign);
        const conditional = commitments.find(
          (c) => c.hashToSign === generatedConditional.hashToSign,
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
      const generatedSetState = getSetStateCommitment(context, updatedChannel.freeBalance);
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
      break;
    }

    default: {
      const c: never = type;
      throw new Error(`Could not create updated channel, unrecognized sync type: ${c}`);
    }
  }

  return [updatedChannel, persistType, verifiedCommitments];
}

function syncRejectedApps(
  myChannel: StateChannel,
  counterpartyProposals: string[],
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
