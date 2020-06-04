import {
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  StateChannelJSON,
  SetStateCommitmentJSON,
  IStoreService,
  ConditionalTransactionCommitmentJSON,
  ProtocolRoles,
} from "@connext/types";
import {
  logTime,
  stringify,
  toBN,
  getSignerAddressFromPublicIdentifier,
  recoverAddressFromChannelMessage,
} from "@connext/utils";
import { utils } from "ethers";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { StateChannel, AppInstance, FreeBalanceClass } from "../models";
import { Context, ProtocolExecutionFlow, PersistStateChannelType } from "../types";

import { stateChannelClassFromStoreByMultisig, assertIsValidSignature } from "./utils";
import {
  getSetStateCommitment,
  SetStateCommitment,
  ConditionalTransactionCommitment,
  getConditionalTransactionCommitment,
} from "../ethereum";
import { computeInterpreterParameters } from "./install";

const { keccak256, defaultAbiCoder } = utils;

const protocol = ProtocolNames.sync;
const { IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL, OP_SIGN, OP_VALIDATE } = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 */
export const SYNC_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const {
      message,
      store,
      network: { provider },
    } = context;
    const log = context.log.newContext("CF-SyncProtocol");
    const start = Date.now();
    let substart = start;
    const { processID, params } = message;
    log.info(`[${processID}] Initiation started: ${stringify(params)}`);

    const {
      multisigAddress,
      responderIdentifier,
      initiatorIdentifier,
    } = params as ProtocolParams.Sync;
    const ourIdentifier = initiatorIdentifier;
    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );
    const { setStateCommitments, conditionalCommitments } = await getCommitmentsFromChannel(
      preProtocolStateChannel,
      store,
    );
    const m1 = {
      protocol,
      processID,
      params,
      seq: 1,
      to: responderIdentifier,
      customData: {
        channel: preProtocolStateChannel.toJson(),
        setStateCommitments,
        conditionalCommitments,
      },
    } as ProtocolMessageData;

    substart = Date.now();

    // 200ms
    const m2 = yield [IO_SEND_AND_WAIT, m1];
    logTime(log, substart, `[${processID}] Received responder's m2`);
    substart = Date.now();

    const {
      data: {
        customData: {
          channel: responderChannelJson,
          setStateCommitments: responderSetStateCommitments,
          conditionalCommitments: responderConditionalCommitments,
        },
      },
    }: {
      data: {
        customData: {
          channel: StateChannelJSON;
          setStateCommitments: SetStateCommitmentJSON[];
          conditionalCommitments: ConditionalTransactionCommitmentJSON[];
        };
      };
    } = m2!;

    const responderChannel = StateChannel.fromJson(responderChannelJson);
    let postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());

    const syncType = needsSyncFromCounterparty(preProtocolStateChannel, responderChannel);
    log.debug(`[${processID}] Syncing channel with type: ${syncType}`);
    substart = Date.now();
    switch (syncType) {
      case PersistStateChannelType.SyncProposal: {
        // sync and save all proposals
        const proposalSync = await syncUntrackedProposals(
          postSyncStateChannel,
          responderChannel,
          responderSetStateCommitments,
          context,
          ourIdentifier,
        );
        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncProposal,
          proposalSync!.updatedChannel,
          proposalSync!.commitments,
        ];
        postSyncStateChannel = StateChannel.fromJson(proposalSync!.updatedChannel.toJson());
        logTime(log, substart, `[${processID}] Synced proposals with responder`);
        break;
      }
      case PersistStateChannelType.SyncFreeBalance: {
        const freeBalanceSync = await syncFreeBalanceState(
          postSyncStateChannel,
          setStateCommitments,
          responderChannel,
          responderSetStateCommitments,
          responderConditionalCommitments,
          ourIdentifier,
        );
        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncFreeBalance,
          freeBalanceSync!.updatedChannel,
          freeBalanceSync!.commitments,
        ];
        postSyncStateChannel = StateChannel.fromJson(freeBalanceSync!.updatedChannel.toJson());
        logTime(log, substart, `[${processID}] Synced free balance with responder`);
        break;
      }
      case PersistStateChannelType.SyncAppInstances: {
        const appSync = await syncAppStates(
          postSyncStateChannel,
          responderChannel,
          responderSetStateCommitments,
          ourIdentifier,
        );

        const { commitments, updatedChannel } = appSync!;

        // update the channel with any double signed commitments
        if (updatedChannel) {
          postSyncStateChannel = StateChannel.fromJson(updatedChannel.toJson());
        }

        const doubleSigned: SetStateCommitment[] = [];
        // process single-signed commitments
        for (const commitment of commitments) {
          if (commitment.signatures.length === 2) {
            doubleSigned.push(commitment);
            continue;
          }

          const responderApp = responderChannel.appInstances.get(commitment.appIdentityHash)!;
          const app = postSyncStateChannel.appInstances.get(commitment.appIdentityHash)!;

          // signature has been validated, add our signature
          const error = yield [
            OP_VALIDATE,
            ProtocolNames.takeAction,
            {
              params: {
                initiatorIdentifier: responderIdentifier, // from *this* protocol
                responderIdentifier: ourIdentifier,
                multisigAddress: postSyncStateChannel.multisigAddress,
                appIdentityHash: app.identityHash,
                action: responderApp.latestAction,
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
          postSyncStateChannel.setState(
            app,
            await app.computeStateTransition(responderApp!.latestAction, provider),
            commitment.stateTimeout,
          );

          // counterparty sig has already been asserted, add sign to commitment
          // and update channel
          const isAppInitiator = app.initiatorIdentifier === ourIdentifier;
          const mySig = yield [OP_SIGN, commitment.hashToSign()];
          await commitment.addSignatures(
            isAppInitiator ? (mySig as any) : commitment.signatures[0],
            isAppInitiator ? commitment.signatures[1] : (mySig as any),
          );
          doubleSigned.push(commitment);
        }

        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncAppInstances,
          postSyncStateChannel,
          doubleSigned,
        ];

        logTime(log, substart, `[${processID}] Synced app states with responder`);
        break;
      }
      case PersistStateChannelType.NoChange: {
        // use yield syntax to properly return values from the protocol
        // to the controllers
        yield [PERSIST_STATE_CHANNEL, PersistStateChannelType.NoChange, postSyncStateChannel];
        logTime(log, start, `[${processID}] No sync from counterparty needed`);
        break;
      }
      case PersistStateChannelType.CreateChannel: {
        throw new Error(`Cannot sync type: ${syncType}`);
      }
      default:
        const c: never = syncType;
        log.error(`Unreachable: ${c}`);
    }

    logTime(log, start, `[${processID}] Initiation finished`);
  },

  1 /* Responding */: async function* (context: Context) {
    const {
      message,
      store,
      network: { provider },
    } = context;
    const { params, processID } = message;
    const log = context.log.newContext("CF-SyncProtocol");
    const start = Date.now();
    let substart = start;
    log.info(`[${processID}] Response started ${stringify(params)}`);

    const {
      multisigAddress,
      initiatorIdentifier,
      responderIdentifier,
    } = params as ProtocolParams.Sync;
    const ourIdentifier = responderIdentifier;

    const {
      customData: {
        channel: initiatorChannelJson,
        setStateCommitments: initiatorSetStateCommitments,
        conditionalCommitments: initiatorConditionalCommitments,
      },
    } = message;

    const initiatorChannel = StateChannel.fromJson(initiatorChannelJson);
    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    const { setStateCommitments, conditionalCommitments } = await getCommitmentsFromChannel(
      preProtocolStateChannel,
      store,
    );

    let postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());
    const messageToSend = {
      protocol,
      processID,
      params,
      seq: UNASSIGNED_SEQ_NO,
      to: initiatorIdentifier,
      customData: {
        channel: preProtocolStateChannel.toJson(),
        setStateCommitments,
        conditionalCommitments,
      },
    };

    const syncType = needsSyncFromCounterparty(preProtocolStateChannel, initiatorChannel);
    log.debug(`[${processID}] Syncing channel with type: ${syncType}`);
    substart = Date.now();
    switch (syncType) {
      case PersistStateChannelType.SyncProposal: {
        // sync and save all proposals
        const proposalSync = await syncUntrackedProposals(
          postSyncStateChannel,
          initiatorChannel,
          initiatorSetStateCommitments,
          context,
          ourIdentifier,
        );
        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncProposal,
          proposalSync!.updatedChannel,
          proposalSync!.commitments,
        ];
        postSyncStateChannel = StateChannel.fromJson(proposalSync!.updatedChannel.toJson());
        logTime(log, substart, `[${processID}] Synced proposals with initiator`);
        break;
      }
      case PersistStateChannelType.SyncFreeBalance: {
        const freeBalanceSync = await syncFreeBalanceState(
          postSyncStateChannel,
          setStateCommitments,
          initiatorChannel,
          initiatorSetStateCommitments,
          initiatorConditionalCommitments,
          ourIdentifier,
        );
        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncFreeBalance,
          freeBalanceSync!.updatedChannel,
          freeBalanceSync!.commitments,
        ];
        postSyncStateChannel = StateChannel.fromJson(freeBalanceSync!.updatedChannel.toJson());
        logTime(log, substart, `[${processID}] Synced free balance with initiator`);
        break;
      }
      case PersistStateChannelType.SyncAppInstances: {
        const appSync = await syncAppStates(
          postSyncStateChannel,
          initiatorChannel,
          initiatorSetStateCommitments,
          ourIdentifier,
        );

        const { commitments, updatedChannel } = appSync!;

        // update the channel with any double signed commitments
        if (updatedChannel) {
          postSyncStateChannel = StateChannel.fromJson(updatedChannel.toJson());
        }

        const doubleSigned: SetStateCommitment[] = [];
        // process single-signed commitments
        for (const commitment of commitments) {
          if (commitment.signatures.length === 2) {
            doubleSigned.push(commitment);
            continue;
          }

          const initiatorApp = initiatorChannel.appInstances.get(commitment.appIdentityHash)!;
          const app = postSyncStateChannel.appInstances.get(commitment.appIdentityHash)!;

          // signature has been validated, add our signature
          const error = yield [
            OP_VALIDATE,
            ProtocolNames.takeAction,
            {
              params: {
                initiatorIdentifier: responderIdentifier, // from *this* protocol
                responderIdentifier: ourIdentifier,
                multisigAddress: postSyncStateChannel.multisigAddress,
                appIdentityHash: app.identityHash,
                action: initiatorApp.latestAction,
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
          postSyncStateChannel.setState(
            app,
            await app.computeStateTransition(initiatorApp!.latestAction, provider),
            commitment.stateTimeout,
          );

          // counterparty sig has already been asserted, add sign to commitment
          // and update channel
          const isAppInitiator = app.initiatorIdentifier === ourIdentifier;
          const mySig = yield [OP_SIGN, commitment.hashToSign()];
          await commitment.addSignatures(
            isAppInitiator ? (mySig as any) : commitment.signatures[0],
            isAppInitiator ? commitment.signatures[1] : (mySig as any),
          );
          doubleSigned.push(commitment);
        }

        yield [
          PERSIST_STATE_CHANNEL,
          PersistStateChannelType.SyncAppInstances,
          postSyncStateChannel,
          doubleSigned,
        ];

        logTime(log, substart, `[${processID}] Synced app states with initiator`);
        break;
      }
      case PersistStateChannelType.NoChange: {
        // use yield syntax to properly return values from the protocol
        // to the controllers
        yield [PERSIST_STATE_CHANNEL, PersistStateChannelType.NoChange, postSyncStateChannel];
        logTime(log, substart, `[${processID}] No sync from counterparty needed`);
        break;
      }
      case PersistStateChannelType.CreateChannel: {
        throw new Error(`Cannot sync type: ${syncType}`);
      }
      default:
        const c: never = syncType;
        log.error(`Unreachable: ${c}`);
    }

    logTime(log, substart, `[${processID}] Synced channel with initator`);

    yield [IO_SEND, messageToSend, postSyncStateChannel];
    logTime(log, start, `[${processID}] Response finished`);
  },
};

async function syncAppStates(
  ourChannel: StateChannel,
  counterpartyChannel: StateChannel,
  counterpartySetState: SetStateCommitmentJSON[],
  publicIdentifier: string,
) {
  let updatedChannel: StateChannel | undefined = undefined;
  const commitments: SetStateCommitment[] = [];

  for (const ourApp of [...ourChannel.appInstances.values()]) {
    const counterpartyApp = counterpartyChannel.appInstances.get(ourApp.identityHash);
    if (!counterpartyApp || ourApp.latestVersionNumber >= counterpartyApp.latestVersionNumber) {
      continue;
    }
    if (ourApp.latestVersionNumber + 1 !== counterpartyApp.latestVersionNumber) {
      throw new Error(`Cannot sync by more than one app update, use restore instead.`);
    }
    const json = counterpartySetState.find(
      (c) =>
        c.appIdentityHash === ourApp.identityHash &&
        toBN(c.versionNumber).eq(counterpartyApp.versionNumber),
    );
    if (!json) {
      throw new Error(`No corresponding set state commitment for ${ourApp.identityHash}, aborting`);
    }
    const counterpartyCommitment = SetStateCommitment.fromJson(json);
    if (counterpartyCommitment.appStateHash !== counterpartyApp.hashOfLatestState) {
      throw new Error(
        `Counterparty commitment and counterparty app do not have the same latest state hash, aborting`,
      );
    }
    // make sure we signed the commiment if it is double signed, if it is single signed
    // check that it is a valid signature from the counterparty
    if (counterpartyCommitment.signatures.length === 1) {
      await assertIsValidSignature(
        ourChannel.multisigOwners.find(
          (addr) => addr !== getSignerAddressFromPublicIdentifier(publicIdentifier),
        )!,
        counterpartyCommitment.hashToSign(),
        counterpartyCommitment.signatures.find((sig) => !!sig),
        `Failed to validate counterparty's signature on set state commitment when syncing app instance ${
          ourApp.identityHash
        }. Counterparty commitment: ${stringify(json)}, our channel: ${stringify(
          ourChannel.toJson(),
        )}`,
      );
    } else {
      await assertSignerPresent(
        getSignerAddressFromPublicIdentifier(publicIdentifier),
        counterpartyCommitment,
      );
      // commitment is valid and double signed, update channel
      updatedChannel = ourChannel.setState(
        ourApp,
        counterpartyApp.latestState,
        toBN(counterpartyApp.stateTimeout),
      );
      // commitment is valid but single signed, dont update channel
    }
    // commitment is valid
    commitments.push(counterpartyCommitment);
  }

  if (!updatedChannel && commitments.length === 0) {
    // no updates were made to any of our apps
    return undefined;
  }

  return {
    updatedChannel,
    commitments,
  };
}

// will update the channel object if needed to sync the free balance apps
// between the counterparties. this sync represents an incompleted install
// or uninstall protocol. IFF the protocol was an uninstall, the fn will
// return only one commitment (their missing set state commitment) and if
// the protocol was an install, it will return both missing commitments
// (the set state for the free balance and the conditional)
async function syncFreeBalanceState(
  ourChannel: StateChannel,
  ourSetState: SetStateCommitmentJSON[],
  counterpartyChannel: StateChannel,
  counterpartySetState: SetStateCommitmentJSON[],
  counterpartyConditional: ConditionalTransactionCommitmentJSON[],
  publicIdentifier: string,
) {
  const ourFreeBalance = ourChannel.freeBalance;
  const counterpartyFreeBalance = counterpartyChannel.freeBalance;
  if (ourFreeBalance.latestVersionNumber >= counterpartyFreeBalance.latestVersionNumber) {
    // we are ahead, counterparty should sync with us
    return undefined;
  }
  if (ourFreeBalance.latestVersionNumber !== counterpartyFreeBalance.latestVersionNumber - 1) {
    throw new Error(`Cannot sync by more than one free balance update, use restore instead.`);
  }
  const json = counterpartySetState.find(
    (commitment) =>
      commitment.appIdentityHash === ourFreeBalance.identityHash &&
      toBN(commitment.versionNumber).eq(counterpartyFreeBalance.versionNumber),
  );
  if (!json) {
    throw new Error(
      `No corresponding set state commitment found for free balance app at nonce ${counterpartyFreeBalance.latestVersionNumber}, aborting`,
    );
  }
  // make sure we signed the commitments
  const freeBalanceSetState = SetStateCommitment.fromJson(json);
  const signer = getSignerAddressFromPublicIdentifier(publicIdentifier);
  await assertSignerPresent(signer, freeBalanceSetState);

  const freeBalance = FreeBalanceClass.fromAppInstance(counterpartyFreeBalance);

  // check to see if the free balance update came from an app intall
  // or an app uninstall by looking at the active apps
  const activeAppIds = Object.keys(freeBalance.toFreeBalanceState().activeAppsMap);
  const uninstalledApp = [...ourChannel.appInstances.values()].find((app) => {
    return !activeAppIds.includes(app.identityHash);
  });
  const installedProposal = [...ourChannel.proposedAppInstances.values()].find((proposal) =>
    activeAppIds.includes(proposal.identityHash),
  );

  let updatedChannel: StateChannel;
  let setStateCommitment: SetStateCommitment;
  let conditionalCommitment: ConditionalTransactionCommitment | undefined = undefined;
  if (installedProposal && !uninstalledApp) {
    // set state commitment needed by store is the free balance
    // commitment
    setStateCommitment = SetStateCommitment.fromJson(freeBalanceSetState.toJson());
    // conditional commitment should also be returned
    const conditionalJson = counterpartyConditional.find(
      (c) => c.appIdentityHash === installedProposal.identityHash,
    );
    if (!conditionalJson) {
      throw new Error(
        `Detected an installed proposal, but could not find corresponding conditional commitment`,
      );
    }
    conditionalCommitment = ConditionalTransactionCommitment.fromJson(conditionalJson);
    await assertSignerPresent(signer, conditionalCommitment);
    // add app to channel
    const {
      multiAssetMultiPartyCoinTransferInterpreterParams,
      twoPartyOutcomeInterpreterParams,
      singleAssetTwoPartyCoinTransferInterpreterParams,
    } = computeInterpreterParameters(
      installedProposal.outcomeType,
      installedProposal.initiatorDepositAssetId,
      installedProposal.responderDepositAssetId,
      toBN(installedProposal.initiatorDeposit),
      toBN(installedProposal.responderDeposit),
      getSignerAddressFromPublicIdentifier(installedProposal.initiatorIdentifier),
      getSignerAddressFromPublicIdentifier(installedProposal.responderIdentifier),
      false,
    );
    const appInstance = new AppInstance(
      /* initiator */ installedProposal.initiatorIdentifier,
      /* responder */ installedProposal.responderIdentifier,
      /* defaultTimeout */ installedProposal.defaultTimeout,
      /* appInterface */ {
        addr: installedProposal.appDefinition,
        stateEncoding: installedProposal.abiEncodings.stateEncoding,
        actionEncoding: installedProposal.abiEncodings.actionEncoding,
      },
      /* appSeqNo */ installedProposal.appSeqNo,
      /* latestState */ installedProposal.initialState,
      /* latestVersionNumber */ 1,
      /* stateTimeout */ installedProposal.stateTimeout,
      /* outcomeType */ installedProposal.outcomeType,
      /* multisig */ ourChannel.multisigAddress,
      installedProposal.meta,
      /* latestAction */ undefined,
      twoPartyOutcomeInterpreterParams,
      multiAssetMultiPartyCoinTransferInterpreterParams,
      singleAssetTwoPartyCoinTransferInterpreterParams,
    );
    updatedChannel = ourChannel
      .removeProposal(appInstance.identityHash)
      .addAppInstance(appInstance)
      .setFreeBalance(freeBalance);
  } else if (uninstalledApp && !installedProposal) {
    // set state commitment needed here is for the app
    // counterparty may not have this since it is uninstalled,
    // so find from our records
    const json = ourSetState.find(
      (c) =>
        c.appIdentityHash === uninstalledApp.identityHash &&
        toBN(c.versionNumber).eq(uninstalledApp.versionNumber),
    );
    if (!json) {
      throw new Error(
        `Failed to find final set state commitment for app in counterparty's commitments, aborting. App: ${stringify(
          uninstalledApp,
        )}, counterparty commitments: ${stringify(counterpartySetState)}`,
      );
    }
    setStateCommitment = SetStateCommitment.fromJson(json);
    await assertSignerPresent(
      getSignerAddressFromPublicIdentifier(publicIdentifier),
      setStateCommitment,
    );
    updatedChannel = ourChannel
      .removeAppInstance(uninstalledApp.identityHash)
      .setFreeBalance(freeBalance);
  } else {
    throw new Error(
      `Free balance has higher nonce, but cannot find an app that has been uninstalled or installed, or found both an installed and uninstalled app. Our channel: ${stringify(
        ourChannel.toJson(),
      )}, free balance: ${stringify(freeBalance.toFreeBalanceState())}`,
    );
  }

  return {
    updatedChannel,
    commitments: [setStateCommitment, conditionalCommitment].filter((x) => !!x),
  };
}

// adds a missing proposal from the responder channel to our channel. Is only
// safe for use when there is one proposal missing. Verifies we have signed
// the update before adding the proposal to our channel.s
async function syncUntrackedProposals(
  ourChannel: StateChannel,
  counterpartyChannel: StateChannel,
  setStateCommitments: SetStateCommitmentJSON[],
  context: Context,
  publicIdentifier: string,
) {
  // handle case where we have to add a proposal to our store
  if (ourChannel.numProposedApps >= counterpartyChannel.numProposedApps) {
    // our proposals are ahead, counterparty should sync if needed
    return undefined;
  }
  if (ourChannel.numProposedApps !== counterpartyChannel.numProposedApps - 1) {
    throw new Error(`Cannot sync by more than one proposed app, use restore instead.`);
  }

  const untrackedProposedApp = [...counterpartyChannel.proposedAppInstances.values()].find(
    (app) => !ourChannel.proposedAppInstances.has(app.identityHash),
  );
  if (!untrackedProposedApp) {
    throw new Error(`Cannot find matching untracked proposal in counterparty's store, aborting`);
  }
  const correspondingSetStateCommitment = setStateCommitments.find(
    (p) => p.appIdentityHash === untrackedProposedApp.identityHash,
  );
  if (!correspondingSetStateCommitment) {
    throw new Error(
      `No corresponding set state commitment for ${untrackedProposedApp.identityHash}, aborting`,
    );
  }

  // generate the commitment and verify signatures
  const proposedAppInstance = {
    identity: {
      appDefinition: untrackedProposedApp.appDefinition,
      channelNonce: toBN(counterpartyChannel.numProposedApps),
      participants: counterpartyChannel.getSigningKeysFor(
        untrackedProposedApp.initiatorIdentifier,
        untrackedProposedApp.responderIdentifier,
      ),
      multisigAddress: ourChannel.multisigAddress,
      defaultTimeout: toBN(untrackedProposedApp.defaultTimeout),
    },
    hashOfLatestState: keccak256(
      defaultAbiCoder.encode(
        [untrackedProposedApp.abiEncodings.stateEncoding],
        [untrackedProposedApp.initialState],
      ),
    ),
    versionNumber: 1,
    stateTimeout: untrackedProposedApp.stateTimeout,
    multiAssetMultiPartyCoinTransferInterpreterParams:
      untrackedProposedApp.multiAssetMultiPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams: untrackedProposedApp.twoPartyOutcomeInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams:
      untrackedProposedApp.singleAssetTwoPartyCoinTransferInterpreterParams,
    outcomeType: untrackedProposedApp.outcomeType,
  };
  const setStateCommitment = getSetStateCommitment(context, proposedAppInstance as AppInstance);
  const conditionalCommitment = getConditionalTransactionCommitment(
    context,
    ourChannel,
    proposedAppInstance as AppInstance,
  );
  await setStateCommitment.addSignatures(
    correspondingSetStateCommitment.signatures[0],
    correspondingSetStateCommitment.signatures[1],
  );
  await assertSignerPresent(
    getSignerAddressFromPublicIdentifier(publicIdentifier),
    setStateCommitment,
  );
  const updatedChannel = ourChannel.addProposal(untrackedProposedApp);
  return {
    updatedChannel,
    commitments: [setStateCommitment, conditionalCommitment],
  };
}

async function getCommitmentsFromChannel(channel: StateChannel, store: IStoreService) {
  const commitmentsToFetch = [channel.freeBalance.identityHash]
    .concat([...channel.proposedAppInstances.values()].map((app) => app.identityHash))
    .concat([...channel.appInstances.values()].map((proposal) => proposal.identityHash));

  // fetch all commitments for all apps in channel
  const setStateCommitments = await Promise.all(
    commitmentsToFetch.map(async (id) => {
      // only fetch latest commitment for the app
      const commitments = await store.getSetStateCommitments(id);
      return commitments.sort((a, b) =>
        toBN(b.versionNumber).sub(toBN(a.versionNumber)).toNumber(),
      )[0];
    }),
  );

  const conditionalCommitments = await Promise.all(
    commitmentsToFetch.map((id) => store.getConditionalTransactionCommitment(id)),
  );

  return {
    setStateCommitments: setStateCommitments.filter((x) => !!x),
    conditionalCommitments: conditionalCommitments.filter((x) => !!x),
  };
}

async function assertSignerPresent(
  signer: string,
  commitment: SetStateCommitment | ConditionalTransactionCommitment,
) {
  const signatures = [...commitment.signatures];
  const signers = await Promise.all(
    signatures.map(
      async (sig) => sig && (await recoverAddressFromChannelMessage(commitment.hashToSign(), sig)),
    ),
  );
  const recovered = signers.find((addr) => addr === signer);
  if (!recovered) {
    throw new Error(
      `Could not find valid signer in recovered addresses. Recovered: ${stringify(
        signers,
      )}, expected: ${signer}`,
    );
  }
}

// will return true IFF there is information in our counterparty's channel
// we must update with. Will return false if the responder
function needsSyncFromCounterparty(
  ourChannel: StateChannel,
  counterpartyChannel: StateChannel,
): PersistStateChannelType {
  // check channel nonces
  // covers interruptions in: propose
  if (ourChannel.numProposedApps < counterpartyChannel.numProposedApps) {
    return PersistStateChannelType.SyncProposal;
  }

  // check free balance nonces
  // covers interruptions in: uninstall, install
  if (
    ourChannel.freeBalance.latestVersionNumber < counterpartyChannel.freeBalance.latestVersionNumber
  ) {
    return PersistStateChannelType.SyncFreeBalance;
  }

  // because we know we have the latest free balance nonce,
  // we can assume we have the most up to date list of installed
  // app instances. If the counterparty does NOT have an app that
  // you do, you know they are out of sync, not you

  // make sure all apps have the same nonce
  // covers interruptions in: takeAction
  let needCounterpartyAppData = false;
  [...ourChannel.appInstances.values()].forEach((app) => {
    if (needCounterpartyAppData) {
      return;
    }
    const counterpartyCopy = counterpartyChannel.appInstances.get(app.identityHash);
    if (counterpartyCopy && counterpartyCopy.latestVersionNumber > app.latestVersionNumber) {
      needCounterpartyAppData = true;
    }
  });

  return needCounterpartyAppData
    ? PersistStateChannelType.SyncAppInstances
    : PersistStateChannelType.NoChange;
}
