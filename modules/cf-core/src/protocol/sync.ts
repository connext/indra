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
  delay,
} from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { StateChannel, AppInstance, FreeBalanceClass } from "../models";
import { Context, ProtocolExecutionFlow, PersistStateChannelType } from "../types";

import { stateChannelClassFromStoreByMultisig, assertIsValidSignature } from "./utils";
import {
  getSetStateCommitment,
  SetStateCommitment,
  ConditionalTransactionCommitment,
} from "../ethereum";
import { keccak256, defaultAbiCoder } from "ethers/utils";
import { computeInterpreterParameters } from "./install";

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

    if (!needsSyncFromCounterparty(preProtocolStateChannel, responderChannel)) {
      log.debug(`No sync from counterparty needed, completing.`);
      // use yield syntax to properly return values from the protocol
      // to the controllers
      yield [PERSIST_STATE_CHANNEL, PersistStateChannelType.NoChange, preProtocolStateChannel];
      logTime(log, start, `[${processID}] Initiation finished`);
      return;
    }

    let postSyncStateChannel = StateChannel.fromJson(preProtocolStateChannel.toJson());
    // sync and save all proposals
    substart = Date.now();
    const proposalSync = await syncUntrackedProposals(
      postSyncStateChannel,
      responderChannel,
      responderSetStateCommitments,
      context,
      ourIdentifier,
    );
    if (proposalSync) {
      yield [
        PERSIST_STATE_CHANNEL,
        PersistStateChannelType.SyncProposal,
        proposalSync.updatedChannel,
        proposalSync.commitments,
      ];
      postSyncStateChannel = StateChannel.fromJson(proposalSync.updatedChannel.toJson());
    }
    logTime(log, substart, `[${processID}] Synced proposals with responder`);

    // sync and save free balance
    substart = Date.now();
    const freeBalanceSync = await syncFreeBalanceState(
      postSyncStateChannel,
      responderChannel,
      responderSetStateCommitments,
      responderConditionalCommitments,
      ourIdentifier,
    );
    if (freeBalanceSync) {
      yield [
        PERSIST_STATE_CHANNEL,
        PersistStateChannelType.SyncFreeBalance,
        freeBalanceSync.updatedChannel,
        freeBalanceSync.commitments,
      ];
      postSyncStateChannel = StateChannel.fromJson(freeBalanceSync.updatedChannel.toJson());
    }
    logTime(log, substart, `[${processID}] Synced free balance with responder`);

    // sync and save all app instances
    substart = Date.now();
    const appSync = await syncAppStates(
      postSyncStateChannel,
      responderChannel,
      responderSetStateCommitments,
      ourIdentifier,
    );
    if (!appSync) {
      logTime(log, start, `[${processID}] Initiation finished`);
      return;
    }

    const { commitments, updatedChannel } = appSync;

    // update the channel with any double signed commitments
    if (updatedChannel) {
      postSyncStateChannel = StateChannel.fromJson(updatedChannel.toJson());
    }

    let doubleSigned: SetStateCommitment[] = [];
    // process single-signed commitments
    for (const commitment of commitments) {
      if (commitment.signatures.length === 2) {
        doubleSigned.push(commitment);
        continue;
      }

      const responderApp = responderChannel.appInstances.get(commitment.appIdentityHash)!;
      const app = postSyncStateChannel.appInstances.get(commitment.appIdentityHash)!;

      // signature has been validated, add our signature
      yield [
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

    logTime(log, start, `[${processID}] Initiation finished`);
  },

  1 /* Responding */: async function* (context: Context) {
    const { message, store } = context;
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
    if (!needsSyncFromCounterparty(preProtocolStateChannel, initiatorChannel)) {
      // immediately send message without updating channel
      log.debug(`No sync from counterparty needed, sending response and completing.`);
      yield [IO_SEND, messageToSend, postSyncStateChannel];
      logTime(log, start, `[${processID}] Response finished`);
      return;
    }

    // sync and save all proposals
    substart = Date.now();
    const ret = await syncUntrackedProposals(
      postSyncStateChannel,
      initiatorChannel,
      initiatorSetStateCommitments,
      context,
      ourIdentifier,
    );
    if (ret) {
      postSyncStateChannel = StateChannel.fromJson(ret.updatedChannel.toJson());
      yield [
        PERSIST_STATE_CHANNEL,
        PersistStateChannelType.SyncProposal,
        postSyncStateChannel,
        ret.commitments,
      ];
    }
    logTime(log, substart, `[${processID}] Synced proposals with initator`);

    // sync and save free balance
    substart = Date.now();
    const freeBalanceSync = await syncFreeBalanceState(
      postSyncStateChannel,
      initiatorChannel,
      initiatorSetStateCommitments,
      initiatorConditionalCommitments,
      ourIdentifier,
    );
    if (freeBalanceSync) {
      yield [
        PERSIST_STATE_CHANNEL,
        PersistStateChannelType.SyncFreeBalance,
        freeBalanceSync.updatedChannel,
        freeBalanceSync.commitments,
      ];
      postSyncStateChannel = StateChannel.fromJson(freeBalanceSync.updatedChannel.toJson());
    }
    logTime(log, substart, `[${processID}] Synced free balance with initiator`);

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
  let commitments: SetStateCommitment[] = [];

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
  const commitment = SetStateCommitment.fromJson(json);
  const signer = getSignerAddressFromPublicIdentifier(publicIdentifier);
  await assertSignerPresent(signer, commitment);

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

  let updatedChannel;
  let conditionalCommitment;
  if (installedProposal && !uninstalledApp) {
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
    commitments: [commitment, conditionalCommitment].filter((x) => !!x),
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
  };
  const generatedCommitment = getSetStateCommitment(context, proposedAppInstance as AppInstance);
  await generatedCommitment.addSignatures(
    correspondingSetStateCommitment.signatures[0],
    correspondingSetStateCommitment.signatures[1],
  );
  await assertSignerPresent(
    getSignerAddressFromPublicIdentifier(publicIdentifier),
    generatedCommitment,
  );
  const updatedChannel = ourChannel.addProposal(untrackedProposedApp);
  return {
    updatedChannel,
    commitments: [generatedCommitment],
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
): boolean {
  // check channel nonces
  // covers interruptions in: propose
  if (ourChannel.numProposedApps < counterpartyChannel.numProposedApps) {
    return true;
  }

  // check free balance nonces
  // covers interruptions in: uninstall, install
  if (
    ourChannel.freeBalance.latestVersionNumber < counterpartyChannel.freeBalance.latestVersionNumber
  ) {
    return true;
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

  return needCounterpartyAppData;
}
