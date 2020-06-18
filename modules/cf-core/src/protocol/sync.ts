import {
  ConditionalTransactionCommitmentJSON,
  IStoreService,
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  SetStateCommitmentJSON,
  AppInstanceJson,
} from "@connext/types";
import { logTime, stringify, toBN, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { UNASSIGNED_SEQ_NO } from "../constants";
import { StateChannel, FreeBalanceClass, AppInstance } from "../models";
import { Context, ProtocolExecutionFlow, PersistStateChannelType } from "../types";

import { stateChannelClassFromStoreByMultisig, assertIsValidSignature } from "./utils";
import { ConditionalTransactionCommitment, SetStateCommitment } from "../ethereum";

const protocol = ProtocolNames.sync;
const { IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL, OP_SIGN, OP_VALIDATE } = Opcode;

type AppSyncObj = { identityHash: string; latestVersionNumber: number };

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
    const loggerId = (params as ProtocolParams.Sync).multisigAddress || processID;
    log.info(`[${loggerId}] Initiation started: ${stringify(params)}`);

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
      customData: { ...getSyncTypeCustomData(preProtocolStateChannel) },
    } as ProtocolMessageData;

    substart = Date.now();

    // 200ms
    const m2 = yield [IO_SEND_AND_WAIT, m1];
    logTime(log, substart, `[${loggerId}] Received responder's m2`);
    substart = Date.now();

    const {
      data: {
        customData: {
          numProposedApps: responderNumProposedApps,
          freeBalanceVersionNumber: responderFreeBalanceVersionNumber,
          proposedAppVersionNumbers: responderProposalVersionNumbers,
          appVersionNumbers: responderAppVersionNumbers,
          app: responderApp,
          commitments: responderCommitments,
          unsyncedApp,
          freeBalanceSyncType,
        },
      },
    }: {
      data: {
        customData: {
          numProposedApps: number;
          freeBalanceVersionNumber: number;
          proposedAppVersionNumbers: AppSyncObj[];
          appVersionNumbers: AppSyncObj[];
          commitments: {
            setState: SetStateCommitmentJSON;
            conditional?: ConditionalTransactionCommitmentJSON;
          };
          app: AppInstanceJson;
          unsyncedApp?: AppInstanceJson;
          freeBalanceSyncType?: "install" | "uninstall";
        };
      };
    } = m2!;

    let postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());

    // Get all information for counterparty to sync
    const syncType = needsSyncFromCounterparty(
      preProtocolStateChannel,
      responderNumProposedApps,
      responderProposalVersionNumbers,
      responderFreeBalanceVersionNumber,
      responderAppVersionNumbers,
    );
    log.info(`[${loggerId}] Initiator syncing with: ${stringify(syncType)}`);
    let counterpartySyncInfo: any;
    if (syncType.whosSync === "theirs") {
      switch (syncType.syncType) {
        case PersistStateChannelType.NoChange:
        case PersistStateChannelType.SyncNumProposedApps: {
          // have all info in message to send already
          break;
        }
        case PersistStateChannelType.SyncProposal: {
          // message needs missing set state commitment and missing
          // conditional commitment info
          counterpartySyncInfo = {
            ...getProposalSyncInfoForCounterparty(
              postSyncStateChannel,
              responderProposalVersionNumbers,
              setStateCommitments,
              conditionalCommitments,
            ),
          };
          break;
        }
        case PersistStateChannelType.SyncFreeBalance: {
          counterpartySyncInfo = {
            ...getFreeBalanceSyncInfoForCounterparty(
              postSyncStateChannel,
              responderFreeBalanceVersionNumber,
              responderAppVersionNumbers,
              responderProposalVersionNumbers,
              setStateCommitments,
            ),
          };
          break;
        }
        case PersistStateChannelType.SyncAppInstances: {
          counterpartySyncInfo = {
            ...getAppStateSyncInfoForCounterparty(
              postSyncStateChannel,
              responderAppVersionNumbers,
              setStateCommitments,
            ),
          };
          break;
        }
        case PersistStateChannelType.CreateChannel: {
          throw new Error(`Cannot sync type: ${syncType}`);
        }
        default: {
          const c: never = syncType.syncType;
          throw new Error(`Invalid sync type: ${c}`);
        }
      }
    } else {
      // create empty object so counterparty can destructure
      counterpartySyncInfo = {
        commitments: {},
        app: {},
      };
    }

    const m3 = {
      protocol,
      processID,
      params,
      seq: 2,
      to: responderIdentifier,
      customData: { ...counterpartySyncInfo },
    };

    yield [IO_SEND_AND_WAIT, m3, postSyncStateChannel];
    logTime(log, substart, `[${loggerId}] Received responder's m4`);
    substart = Date.now();

    if (syncType.whosSync === "ours") {
      substart = Date.now();
      switch (syncType.syncType) {
        case PersistStateChannelType.SyncNumProposedApps: {
          const proposalSync = syncNumProposedApps(postSyncStateChannel, responderNumProposedApps);
          if (proposalSync) {
            yield [
              PERSIST_STATE_CHANNEL,
              PersistStateChannelType.SyncNumProposedApps,
              proposalSync.updatedChannel,
            ];
            postSyncStateChannel = StateChannel.fromJson(proposalSync!.updatedChannel.toJson());
          }
          logTime(log, substart, `[${loggerId}] Synced proposals with responder`);
          break;
        }
        case PersistStateChannelType.SyncProposal: {
          // sync and save all proposals
          const proposalSync = await syncUntrackedProposals(
            postSyncStateChannel,
            responderNumProposedApps,
            responderApp,
            responderCommitments.setState,
            responderCommitments.conditional!,
          );
          yield [
            PERSIST_STATE_CHANNEL,
            PersistStateChannelType.SyncProposal,
            proposalSync!.updatedChannel,
            proposalSync!.commitments,
          ];
          postSyncStateChannel = StateChannel.fromJson(proposalSync!.updatedChannel.toJson());
          logTime(log, substart, `[${loggerId}] Synced proposals with responder`);
          break;
        }
        case PersistStateChannelType.SyncFreeBalance: {
          const freeBalanceSync = await syncFreeBalanceState(
            postSyncStateChannel,
            responderFreeBalanceVersionNumber,
            responderCommitments.setState,
            responderApp,
            unsyncedApp!,
            freeBalanceSyncType!,
          );
          yield [
            PERSIST_STATE_CHANNEL,
            PersistStateChannelType.SyncFreeBalance,
            freeBalanceSync!.updatedChannel,
            freeBalanceSync!.commitments,
            freeBalanceSync!.appContext,
          ];
          postSyncStateChannel = StateChannel.fromJson(freeBalanceSync!.updatedChannel.toJson());
          logTime(log, substart, `[${loggerId}] Synced free balance with responder`);
          break;
        }
        case PersistStateChannelType.SyncAppInstances: {
          const appSync = await syncAppStates(
            postSyncStateChannel,
            responderApp,
            responderCommitments.setState,
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

            const app = postSyncStateChannel.appInstances.get(commitment.appIdentityHash)!;

            // signature has been validated, add our signature
            // NOTE: iff commitment is single signed, we were the responder
            // in the take action commitment, and they initiated it
            const error = yield [
              OP_VALIDATE,
              ProtocolNames.takeAction,
              {
                params: {
                  initiatorIdentifier,
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
              await app.computeStateTransition(responderApp.latestAction, provider),
              commitment.stateTimeout,
            );

            // counterparty sig has already been asserted, sign commitment
            // and update channel
            const mySig = yield [OP_SIGN, commitment.hashToSign()];
            await commitment.addSignatures(
              mySig,
              commitment.signatures.find((x) => !!x),
            );
            doubleSigned.push(commitment);
          }

          yield [
            PERSIST_STATE_CHANNEL,
            PersistStateChannelType.SyncAppInstances,
            postSyncStateChannel,
            doubleSigned,
          ];

          logTime(log, substart, `[${loggerId}] Synced app states with responder`);
          break;
        }
        case PersistStateChannelType.NoChange: {
          // use yield syntax to properly return values from the protocol
          // to the controllers
          yield [PERSIST_STATE_CHANNEL, PersistStateChannelType.NoChange, postSyncStateChannel];
          logTime(log, substart, `[${loggerId}] No sync from responder needed`);
          break;
        }
        case PersistStateChannelType.CreateChannel: {
          throw new Error(`Cannot sync type: ${syncType}`);
        }
        default:
          const c: never = syncType.syncType;
          log.error(`Unreachable: ${c}`);
      }

      logTime(log, substart, `[${loggerId}] Synced channel with responder`);
    }

    logTime(log, start, `[${loggerId}] Initiation finished`);
  },

  1 /* Responding */: async function* (context: Context) {
    const {
      message,
      store,
      network: { provider },
      preProtocolStateChannel,
    } = context;
    const { params, processID } = message;
    const log = context.log.newContext("CF-SyncProtocol");
    const start = Date.now();
    let substart = start;
    const loggerId = (params as ProtocolParams.Sync).multisigAddress || processID;
    log.info(`[${loggerId}] Response started ${stringify(params)}`);

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for sync");
    }

    const { initiatorIdentifier, responderIdentifier } = params as ProtocolParams.Sync;
    const ourIdentifier = responderIdentifier;

    const {
      customData: {
        numProposedApps: initiatorNumProposedApps,
        freeBalanceVersionNumber: initiatorFreeBalanceVersionNumber,
        proposedAppVersionNumbers: initiatorProposalVersionNumbers,
        appVersionNumbers: initiatorAppVersionNumbers,
      },
    } = message;

    const { setStateCommitments, conditionalCommitments } = await getCommitmentsFromChannel(
      preProtocolStateChannel,
      store,
    );

    let postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());
    const syncTypeData = getSyncTypeCustomData(preProtocolStateChannel);

    const syncType = needsSyncFromCounterparty(
      preProtocolStateChannel,
      initiatorNumProposedApps,
      initiatorProposalVersionNumbers,
      initiatorFreeBalanceVersionNumber,
      initiatorAppVersionNumbers,
    );

    // responder m1 will send back all info the counterparty needs to sync
    log.info(`[${loggerId}] Responder syncing with: ${stringify(syncType)}`);
    let counterpartySyncInfo: any;
    if (syncType.whosSync === "theirs") {
      switch (syncType.syncType) {
        case PersistStateChannelType.NoChange:
        case PersistStateChannelType.SyncNumProposedApps: {
          // have all info in message to send already
          break;
        }
        case PersistStateChannelType.SyncProposal: {
          // message needs missing set state commitment and missing
          // conditional commitment info
          counterpartySyncInfo = {
            ...getProposalSyncInfoForCounterparty(
              postSyncStateChannel,
              initiatorProposalVersionNumbers,
              setStateCommitments,
              conditionalCommitments,
            ),
          };
          break;
        }
        case PersistStateChannelType.SyncFreeBalance: {
          counterpartySyncInfo = {
            ...getFreeBalanceSyncInfoForCounterparty(
              postSyncStateChannel,
              initiatorFreeBalanceVersionNumber,
              initiatorAppVersionNumbers,
              initiatorProposalVersionNumbers,
              setStateCommitments,
            ),
          };
          break;
        }
        case PersistStateChannelType.SyncAppInstances: {
          counterpartySyncInfo = {
            ...getAppStateSyncInfoForCounterparty(
              postSyncStateChannel,
              initiatorAppVersionNumbers,
              setStateCommitments,
            ),
          };
          break;
        }
        case PersistStateChannelType.CreateChannel: {
          throw new Error(`Cannot sync type: ${syncType}`);
        }
        default: {
          const c: never = syncType.syncType;
          throw new Error(`Invalid sync type: ${c}`);
        }
      }
    } else {
      // create empty object so counterparty can destructure
      counterpartySyncInfo = {
        commitments: {},
        app: {},
      };
    }

    const m1 = {
      protocol,
      processID,
      params,
      seq: 1,
      to: initiatorIdentifier,
      customData: { ...syncTypeData, ...counterpartySyncInfo },
    };

    const m2 = yield [IO_SEND_AND_WAIT, m1, postSyncStateChannel];
    logTime(log, substart, `[${loggerId}] Received initators's m2`);
    substart = Date.now();
    const {
      data: {
        customData: {
          commitments: initiatorCommitments,
          app: initiatorApp,
          unsyncedApp,
          freeBalanceSyncType,
        },
      },
    }: {
      data: {
        customData: {
          commitments: {
            setState: SetStateCommitmentJSON;
            conditional?: ConditionalTransactionCommitmentJSON;
          };
          app: AppInstanceJson;
          unsyncedApp?: AppInstanceJson;
          freeBalanceSyncType?: "install" | "uninstall";
        };
      };
    } = m2!;

    if (syncType.whosSync === "ours") {
      log.info(`[${loggerId}] Syncing channel with type: ${syncType.syncType}`);
      substart = Date.now();
      switch (syncType.syncType) {
        case PersistStateChannelType.SyncNumProposedApps: {
          const proposalSync = syncNumProposedApps(postSyncStateChannel, initiatorNumProposedApps);
          if (proposalSync) {
            yield [
              PERSIST_STATE_CHANNEL,
              PersistStateChannelType.SyncNumProposedApps,
              proposalSync.updatedChannel,
            ];
            postSyncStateChannel = StateChannel.fromJson(proposalSync!.updatedChannel.toJson());
          }
          logTime(log, substart, `[${loggerId}] Synced proposals with initiator`);
          break;
        }
        case PersistStateChannelType.SyncProposal: {
          // sync and save all proposals
          const proposalSync = await syncUntrackedProposals(
            postSyncStateChannel,
            initiatorNumProposedApps,
            initiatorApp,
            initiatorCommitments.setState,
            initiatorCommitments.conditional!,
          );
          yield [
            PERSIST_STATE_CHANNEL,
            PersistStateChannelType.SyncProposal,
            proposalSync!.updatedChannel,
            proposalSync!.commitments,
          ];
          postSyncStateChannel = StateChannel.fromJson(proposalSync!.updatedChannel.toJson());
          logTime(log, substart, `[${loggerId}] Synced proposals with initiator`);
          break;
        }
        case PersistStateChannelType.SyncFreeBalance: {
          const freeBalanceSync = await syncFreeBalanceState(
            postSyncStateChannel,
            initiatorFreeBalanceVersionNumber,
            initiatorCommitments.setState,
            initiatorApp,
            unsyncedApp!,
            freeBalanceSyncType!,
          );
          yield [
            PERSIST_STATE_CHANNEL,
            PersistStateChannelType.SyncFreeBalance,
            freeBalanceSync!.updatedChannel,
            freeBalanceSync!.commitments,
            freeBalanceSync!.appContext,
          ];
          postSyncStateChannel = StateChannel.fromJson(freeBalanceSync!.updatedChannel.toJson());
          logTime(log, substart, `[${loggerId}] Synced free balance with initiator`);
          break;
        }
        case PersistStateChannelType.SyncAppInstances: {
          const appSync = await syncAppStates(
            postSyncStateChannel,
            initiatorApp,
            initiatorCommitments.setState,
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

            const app = postSyncStateChannel.appInstances.get(commitment.appIdentityHash)!;

            // signature has been validated, add our signature
            // NOTE: iff commitment is single signed, we were the responder
            // in the take action commitment, and they initiated it
            const error = yield [
              OP_VALIDATE,
              ProtocolNames.takeAction,
              {
                params: {
                  initiatorIdentifier,
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

            // counterparty sig has already been asserted, sign commitment
            // and update channel
            const mySig = yield [OP_SIGN, commitment.hashToSign()];
            await commitment.addSignatures(
              mySig,
              commitment.signatures.find((x) => !!x),
            );
            doubleSigned.push(commitment);
          }

          yield [
            PERSIST_STATE_CHANNEL,
            PersistStateChannelType.SyncAppInstances,
            postSyncStateChannel,
            doubleSigned,
          ];

          logTime(log, substart, `[${loggerId}] Synced app states with initiator`);
          break;
        }
        case PersistStateChannelType.NoChange: {
          // use yield syntax to properly return values from the protocol
          // to the controllers
          yield [PERSIST_STATE_CHANNEL, PersistStateChannelType.NoChange, postSyncStateChannel];
          logTime(log, substart, `[${loggerId}] No sync from initiator needed`);
          break;
        }
        case PersistStateChannelType.CreateChannel: {
          throw new Error(`Cannot sync type: ${syncType}`);
        }
        default:
          const c: never = syncType.syncType;
          log.error(`Unreachable: ${c}`);
      }

      logTime(log, substart, `[${loggerId}] Synced channel with initator`);
    }

    // Send an empty ack message so the initiator holds the lock for the
    // duration of responder's protocol execution
    yield [
      IO_SEND,
      {
        protocol,
        processID,
        params,
        seq: UNASSIGNED_SEQ_NO,
        to: initiatorIdentifier,
        customData: {},
      },
      postSyncStateChannel,
    ];
    logTime(log, start, `[${loggerId}] Response finished`);
  },
};

async function syncAppStates(
  ourChannel: StateChannel,
  counterpartyApp: AppInstanceJson,
  counterpartySetState: SetStateCommitmentJSON,
  ourIdentifier: string,
) {
  let updatedChannel: StateChannel | undefined = undefined;
  const setState = SetStateCommitment.fromJson(counterpartySetState);

  // NOTE: here you are making the assumption that you only missed
  // ONE state update on ONE app. This is fine because all operations
  // lock on the multisig address.
  const outOfSyncApp = ourChannel.appInstances.get(counterpartyApp.identityHash);
  if (!outOfSyncApp) {
    throw new Error(
      `Could not find out of sync app with identifier: ${
        counterpartyApp.identityHash
      }. Active apps: ${stringify(ourChannel.appInstances.keys())}`,
    );
  }
  if (toBN(setState.versionNumber).lt(outOfSyncApp.latestVersionNumber)) {
    // we are ahead
    return undefined;
  }
  if (!toBN(setState.versionNumber).eq(outOfSyncApp.latestVersionNumber + 1)) {
    throw new Error(`Cannot sync by more than one app update, use restore instead.`);
  }

  // make sure we signed the commiment if it is double signed, if it is single
  // signed, check that it is a valid signature from the counterparty
  const ourSignerAddr = getSignerAddressFromPublicIdentifier(ourIdentifier);
  if (setState.signatures.length === 1) {
    await assertIsValidSignature(
      ourChannel.multisigOwners.find((addr) => addr !== ourSignerAddr)!,
      setState.hashToSign(),
      setState.signatures.find((sig) => !!sig),
      `Failed to validate counterparty's signature on set state commitment when syncing app instance ${
        outOfSyncApp.identityHash
      }. Counterparty commitment: ${stringify(setState.toJson())}, our channel: ${stringify(
        ourChannel.toJson(),
      )}`,
    );
    // commitment is valid but single signed, dont update channel
  } else {
    await setState.assertSignatures();
    // commitment is valid and double signed, update channel
    updatedChannel = ourChannel.setState(
      outOfSyncApp,
      counterpartyApp.latestState,
      toBN(counterpartyApp.stateTimeout),
    );
  }
  // commitment is valid
  return {
    updatedChannel,
    commitments: [setState],
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
  counterpartyFreeBalanceVersionNumber: number,
  counterpartySetStateCommitment: SetStateCommitmentJSON,
  counterpartyFreeBalance: AppInstanceJson,
  unsyncedApp: AppInstanceJson,
  freeBalanceSyncType: "install" | "uninstall",
) {
  if (ourChannel.freeBalance.latestVersionNumber >= counterpartyFreeBalanceVersionNumber) {
    // we are ahead, counterparty should sync with us
    return undefined;
  }
  if (ourChannel.freeBalance.latestVersionNumber !== counterpartyFreeBalanceVersionNumber - 1) {
    throw new Error(`Cannot sync by more than one free balance update, use restore instead.`);
  }
  // make sure we signed the free balance commitment
  const setState = SetStateCommitment.fromJson(counterpartySetStateCommitment);
  await setState.assertSignatures();

  const freeBalance = FreeBalanceClass.fromAppInstance(
    AppInstance.fromJson(counterpartyFreeBalance),
  );

  // get the unsynced app or proposal
  let unsynced =
    freeBalanceSyncType === "install"
      ? ourChannel.proposedAppInstances.get(unsyncedApp.identityHash)
      : ourChannel.appInstances.get(unsyncedApp.identityHash);
  if (!unsynced) {
    // if we cant find it in our apps, it means we rejected it, so get it from their apps
    unsynced = unsyncedApp;
  }

  // update the channel
  let updatedChannel: StateChannel;
  let appContext: AppInstance | undefined = undefined;
  if (freeBalanceSyncType === "install") {
    updatedChannel = ourChannel
      .removeProposal(unsynced.identityHash)
      .addAppInstance(AppInstance.fromJson(unsynced as AppInstanceJson))
      .setFreeBalance(freeBalance);
  } else {
    updatedChannel = ourChannel
      .removeAppInstance(unsynced.identityHash)
      .setFreeBalance(freeBalance);
    appContext = unsynced as AppInstance;
  }

  return {
    updatedChannel,
    commitments: [setState],
    appContext,
  };
}

function syncNumProposedApps(ourChannel: StateChannel, counterpartyNumProposedApps: number) {
  // handle case where we have to add a proposal to our store
  if (ourChannel.numProposedApps >= counterpartyNumProposedApps) {
    // our proposals are ahead, counterparty should sync if needed
    return undefined;
  }
  if (ourChannel.numProposedApps !== counterpartyNumProposedApps - 1) {
    throw new Error(`Cannot sync by more than one proposed app, use restore instead.`);
  }

  return { updatedChannel: ourChannel.incrementNumProposedApps() };
}

// adds a missing proposal from the responder channel to our channel. Is only
// safe for use when there is one proposal missing. Verifies we have signed
// the update before adding the proposal to our channel.s
async function syncUntrackedProposals(
  ourChannel: StateChannel,
  counterpartyNumProposedApps: number,
  counterpartyProposal: AppInstanceJson, // installed proposal
  counterpartySetState: SetStateCommitmentJSON,
  counterpartyConditional: ConditionalTransactionCommitmentJSON,
) {
  // handle case where we have to add a proposal to our store
  if (ourChannel.numProposedApps >= counterpartyNumProposedApps) {
    // our proposals are ahead, counterparty should sync if needed
    return undefined;
  }
  if (ourChannel.numProposedApps !== counterpartyNumProposedApps - 1) {
    throw new Error(`Cannot sync by more than one proposed app, use restore instead.`);
  }

  // generate the commitment and verify we signed it
  const setStateCommitment = SetStateCommitment.fromJson(counterpartySetState);
  const conditionalCommitment = ConditionalTransactionCommitment.fromJson(counterpartyConditional);
  await setStateCommitment.assertSignatures();
  await conditionalCommitment.assertSignatures();

  // get proposal + verify it is for commitments
  const proposal = AppInstance.fromJson(counterpartyProposal);
  if (
    setStateCommitment.appStateHash !== proposal.hashOfLatestState ||
    conditionalCommitment.appIdentityHash !== proposal.identityHash
  ) {
    throw new Error("Counterparty sent a proposal that does not match the commitments, aborting");
  }

  // update the channel
  const updatedChannel = ourChannel.addProposal(counterpartyProposal);
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
    setStateCommitments: setStateCommitments.filter((x) => !!x) as SetStateCommitmentJSON[],
    conditionalCommitments: conditionalCommitments.filter(
      (x) => !!x,
    ) as ConditionalTransactionCommitment[],
  };
}

// will return true IFF there is information in our counterparty's channel
// we must update with. Will return false if the responder
function needsSyncFromCounterparty(
  ourChannel: StateChannel,
  counterpartyNumProposedApps: number,
  counterpartyProposalVersionNumbers: AppSyncObj[],
  counterpartyFreeBalanceVersionNumber: number,
  counterpartyAppVersionNumbers: AppSyncObj[],
): { whosSync: "ours" | "theirs"; syncType: PersistStateChannelType } {
  // check channel nonces
  // covers interruptions in: propose
  let whosSync: "ours" | "theirs" | undefined = undefined;
  if (ourChannel.numProposedApps < counterpartyNumProposedApps) {
    whosSync = "ours";
    if (ourChannel.proposedAppInstances.size === counterpartyProposalVersionNumbers.length) {
      // their proposal was rejected
      return { whosSync, syncType: PersistStateChannelType.SyncNumProposedApps };
    }
    return { whosSync, syncType: PersistStateChannelType.SyncProposal };
  } else if (ourChannel.numProposedApps > counterpartyNumProposedApps) {
    whosSync = "theirs";
    if (ourChannel.proposedAppInstances.size === counterpartyProposalVersionNumbers.length) {
      // their proposal was rejected
      return { whosSync, syncType: PersistStateChannelType.SyncNumProposedApps };
    }
    return { whosSync, syncType: PersistStateChannelType.SyncProposal };
  }

  // check free balance nonces
  // covers interruptions in: uninstall, install
  if (ourChannel.freeBalance.latestVersionNumber < counterpartyFreeBalanceVersionNumber) {
    whosSync = "ours";
    return { whosSync, syncType: PersistStateChannelType.SyncFreeBalance };
  } else if (ourChannel.freeBalance.latestVersionNumber > counterpartyFreeBalanceVersionNumber) {
    whosSync = "theirs";
    return { whosSync, syncType: PersistStateChannelType.SyncFreeBalance };
  }

  // because we know we have the latest free balance nonce,
  // we can assume we have the most up to date list of installed
  // app instances. If the counterparty does NOT have an app that
  // you do, you know they are out of sync, not you

  // make sure all apps have the same nonce
  // covers interruptions in: takeAction
  counterpartyAppVersionNumbers.forEach(({ identityHash, latestVersionNumber }) => {
    const ours = ourChannel.appInstances.get(identityHash);
    if (!ours) {
      return;
    }
    if (ours.latestVersionNumber < latestVersionNumber) {
      whosSync = "ours";
    } else if (ours.latestVersionNumber > latestVersionNumber) {
      whosSync = "theirs";
    }
  });
  // note: if you return NO_CHANGE here, then the initiator of the protocol
  // will not be able to give the correct info to the counterparty
  return !!whosSync
    ? { whosSync, syncType: PersistStateChannelType.SyncAppInstances }
    : { whosSync: "theirs", syncType: PersistStateChannelType.NoChange };
}

// needs missing set state commitment and missing conditional commitment
// info
function getSyncTypeCustomData(preProtocolStateChannel: StateChannel) {
  return {
    numProposedApps: preProtocolStateChannel.numProposedApps,
    proposedAppVersionNumbers: [...preProtocolStateChannel.proposedAppInstances.values()].map(
      (proposal) => {
        return {
          identityHash: proposal.identityHash,
          latestVersionNumber: proposal.latestVersionNumber,
        };
      },
    ),
    freeBalanceVersionNumber: preProtocolStateChannel.freeBalance.latestVersionNumber,
    appVersionNumbers: [...preProtocolStateChannel.appInstances.values()].map((app) => {
      return { identityHash: app.identityHash, latestVersionNumber: app.latestVersionNumber };
    }),
  };
}

function getProposalSyncInfoForCounterparty(
  ourChannel: StateChannel,
  counterpartyProposalVersionNumbers: AppSyncObj[],
  setStateCommitments: SetStateCommitmentJSON[],
  conditionalCommitments: ConditionalTransactionCommitmentJSON[],
) {
  const ids = counterpartyProposalVersionNumbers.map(({ identityHash }) => identityHash);
  const unsynced = [...ourChannel.proposedAppInstances.values()].find(
    (proposal) => !ids.includes(proposal.identityHash),
  );
  if (!unsynced) {
    throw new Error(
      `Could not find out of sync proposal. Our proposals: ${stringify(
        ourChannel.toJson().proposedAppInstances,
      )}, counterparty app info: ${stringify(counterpartyProposalVersionNumbers)}`,
    );
  }
  // get set state commitment
  const setState = setStateCommitments.find((commitment) => {
    return (
      commitment.appIdentityHash === unsynced.identityHash && toBN(commitment.versionNumber).eq(1)
    );
  });
  const conditional = conditionalCommitments.find((commitment) => {
    return commitment.appIdentityHash === unsynced.identityHash;
  });
  if (!setState || !conditional) {
    throw new Error(
      `Could not find matching commitments for unsynced app info: ${stringify(
        unsynced,
      )}, set state commitments: ${stringify(
        setStateCommitments.map((c) => c.appIdentityHash),
      )}, conditional commitments: ${stringify(
        conditionalCommitments.map((c) => c.appIdentityHash),
      )}.`,
    );
  }
  return { commitments: { setState, conditional }, app: unsynced };
}

// needs latest fb set state commitment from uninstalled app
// OR missing set state + conditional commitment from installed
// proposals
function getFreeBalanceSyncInfoForCounterparty(
  ourChannel: StateChannel,
  counterpartyFreeBalanceVersionNumber: number,
  counterpartyAppVersionNumbers: AppSyncObj[],
  counterpartyProposalVersionNumbers: AppSyncObj[],
  setStateCommitments: SetStateCommitmentJSON[],
) {
  // get our free balance commitment
  const freeBalanceSetState = setStateCommitments.find(
    (c) => c.appIdentityHash === ourChannel.freeBalance.identityHash,
  );
  if (
    !freeBalanceSetState ||
    toBN(freeBalanceSetState.versionNumber).lte(counterpartyFreeBalanceVersionNumber)
  ) {
    throw new Error(
      `No corresponding set state commitment found for free balance app at nonce >${counterpartyFreeBalanceVersionNumber}, aborting. Our set state: ${stringify(
        setStateCommitments.map((c) => c.appIdentityHash),
      )}`,
    );
  }
  // get all our active apps
  const activeAppIds = Object.keys(
    FreeBalanceClass.fromAppInstance(ourChannel.freeBalance).toFreeBalanceState().activeAppsMap,
  );
  const counterpartyActiveApps = counterpartyAppVersionNumbers.map((x) => x.identityHash);
  const counterpartyProposals = counterpartyProposalVersionNumbers.map((x) => x.identityHash);
  const counterpartyApps = counterpartyAppVersionNumbers.map((a) => a.identityHash);
  // free balance gets out of sync by either installing a proposal, or
  // uninstalling an active app
  const uninstalledAppId = counterpartyActiveApps.find((appId) => !activeAppIds.includes(appId));

  // if it's not in their proposals, they rejected it
  const installedProposalId =
    activeAppIds.find((appId) => counterpartyProposals.includes(appId)) ||
    activeAppIds.find((appId) => !counterpartyApps.includes(appId));

  if (!installedProposalId && !uninstalledAppId) {
    throw new Error(
      `No corresponding out of sync proposal or app found. Our active apps: ${stringify(
        activeAppIds,
      )}, their active apps: ${stringify(counterpartyActiveApps)}`,
    );
  }
  if (installedProposalId && uninstalledAppId) {
    throw new Error(
      `Found both an installed proposal and uninstalled app, aborting. Our active apps: ${stringify(
        activeAppIds,
      )}, their active apps: ${stringify(counterpartyActiveApps)}`,
    );
  }

  const unsyncedAppId = uninstalledAppId || installedProposalId;
  const unsyncedApp =
    ourChannel.appInstances.get(unsyncedAppId!)?.toJson() ||
    ourChannel.proposedAppInstances.get(unsyncedAppId!);
  return {
    commitments: { setState: freeBalanceSetState },
    app: ourChannel.freeBalance.toJson(),
    unsyncedApp: unsyncedApp || { identityHash: unsyncedAppId },
    freeBalanceSyncType: unsyncedAppId === uninstalledAppId ? "uninstall" : "install",
  };
}

// needs latest set state commitment from app
function getAppStateSyncInfoForCounterparty(
  ourChannel: StateChannel,
  counterpartyAppVersionNumbers: AppSyncObj[],
  setStateCommitments: SetStateCommitmentJSON[],
) {
  const unsynced = counterpartyAppVersionNumbers.find(({ identityHash, latestVersionNumber }) => {
    const app = ourChannel.appInstances.get(identityHash);
    return app && app.latestVersionNumber !== latestVersionNumber;
  });
  if (!unsynced) {
    throw new Error(
      `Could not find out of sync app instance in our apps. Our apps: ${stringify(
        ourChannel.toJson().appInstances,
      )}, counterparty app info: ${stringify(counterpartyAppVersionNumbers)}`,
    );
  }
  // get set state commitment
  const setState = setStateCommitments.find((commitment) => {
    return commitment.appIdentityHash === unsynced.identityHash;
  });
  if (!setState) {
    throw new Error(
      `Could not find set state commitment for unsynced app info: ${stringify(
        unsynced,
      )}, set state commitments: ${stringify(setStateCommitments)}.`,
    );
  }
  const app = ourChannel.appInstances.get(unsynced.identityHash);
  return { commitments: { setState }, app: app!.toJson() };
}
