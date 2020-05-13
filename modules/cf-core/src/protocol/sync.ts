import {
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  StateChannelJSON,
  SetStateCommitmentJSON,
  IStoreService,
} from "@connext/types";
import {
  logTime,
  stringify,
  toBN,
  getSignerAddressFromPublicIdentifier,
  recoverAddressFromChannelMessage,
} from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { StateChannel, AppInstance } from "../models";
import { Context, ProtocolExecutionFlow, PersistStateChannelType } from "../types";

import { stateChannelClassFromStoreByMultisig } from "./utils";
import { getSetStateCommitment } from "../ethereum";
import { keccak256, defaultAbiCoder } from "ethers/utils";

const protocol = ProtocolNames.sync;
const { IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL } = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 */
export const SYNC_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const { message, store } = context;
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
    const {
      proposalCommitments,
      installedCommitments,
      freeBalanceCommitments,
    } = await getCommitmentsFromChannel(preProtocolStateChannel, store);
    const m1 = {
      protocol,
      processID,
      params,
      seq: 1,
      to: responderIdentifier,
      customData: {
        channel: preProtocolStateChannel.toJson(),
        proposalCommitments,
        freeBalanceCommitments,
        installedCommitments,
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
          proposalCommitments: responderProposalCommitments,
          // freeBalanceComitments: responderFreeBalanceCommitments,
          // installedCommitments: responderInstalledCommitments,
        },
      },
    }: {
      data: {
        customData: {
          channel: StateChannelJSON;
          proposalCommitments: SetStateCommitmentJSON[];
          freeBalanceComitments: SetStateCommitmentJSON[];
          installedCommitments: SetStateCommitmentJSON[];
        };
      };
    } = m2!;

    const responderChannel = StateChannel.fromJson(responderChannelJson);

    if (!needsSyncFromCounterparty(preProtocolStateChannel, responderChannel)) {
      throw new Error("TODO: handle case where responder should sync");
    }

    const {
      updatedChannel: postProposalChannel,
      commitments: postProposalSyncCommitments,
    } = await syncUntrackedProposals(
      preProtocolStateChannel,
      responderChannel,
      responderProposalCommitments,
      context,
      ourIdentifier,
    );

    const commitments = postProposalSyncCommitments;
    const postProtocolStateChannel = postProposalChannel;
    if (!postProtocolStateChannel) {
      throw new Error("wtf tho");
    }

    yield [
      PERSIST_STATE_CHANNEL,
      PersistStateChannelType.SyncProposal,
      postProtocolStateChannel,
      commitments,
    ];

    logTime(log, substart, `[${processID}] Initiation finished`);
  },

  1 /* Responding */: async function* (context: Context) {
    const { message, store } = context;
    const { params, processID } = message;
    const log = context.log.newContext("CF-SyncProtocol");
    const start = Date.now();
    let substart = start;
    log.info(`[${processID}] Response started ${stringify(params)}`);

    const { multisigAddress, initiatorIdentifier } = params as ProtocolParams.Sync;

    const {
      customData: {
        channel: initiatorChannelJson,
        proposalCommitments: initiatorProposalCommitments,
        freeBalanceCommitments: initatorFreeBalanceCommitments,
        installedCommitments: initatorInstalledCommitments,
      },
    } = message;

    const initatorChannel = StateChannel.fromJson(initiatorChannelJson);
    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    const {
      proposalCommitments,
      installedCommitments,
      freeBalanceCommitments,
    } = await getCommitmentsFromChannel(preProtocolStateChannel, store);

    if (needsSyncFromCounterparty(preProtocolStateChannel, initatorChannel)) {
      throw new Error("TODO: Implement responder syncing");
    }

    substart = Date.now();
    yield [
      IO_SEND,
      {
        protocol,
        processID,
        params,
        seq: UNASSIGNED_SEQ_NO,
        to: initiatorIdentifier,
        customData: {
          channel: preProtocolStateChannel.toJson(),
          proposalCommitments,
          freeBalanceCommitments,
          installedCommitments,
        },
      },
      preProtocolStateChannel,
    ];
  },
};

// adds a missing proposal from the responder channel to our channel. Is only
// safe for use when there is one proposal missing. Verifies we have signed
// the update before adding the proposal to our channel.s
async function syncUntrackedProposals(
  ourChannel: StateChannel,
  counterpartyChannel: StateChannel,
  proposalCommitments: SetStateCommitmentJSON[],
  context: Context,
  publicIdentifier: string,
) {
  // handle case where we have to add a proposal to our store
  if (ourChannel.numProposedApps >= counterpartyChannel.numProposedApps) {
    // our proposals are ahead, counterparty should sync if needed
    throw new Error("No proposal sync needed for our channel");
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
  const correspondingSetStateCommitment = proposalCommitments.find(
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
  const signers = await Promise.all(
    correspondingSetStateCommitment.signatures.map((sig) =>
      recoverAddressFromChannelMessage(generatedCommitment.hashToSign(), sig),
    ),
  );
  const signer = getSignerAddressFromPublicIdentifier(publicIdentifier);
  const recovered = signers.find((addr) => addr === signer);
  if (!recovered) {
    throw new Error(
      `Could not find valid signer in recovered addresses. Recovered: ${stringify(
        signers,
      )}, expected: ${signer}`,
    );
  }
  const updatedChannel = ourChannel.addProposal(untrackedProposedApp);
  return {
    updatedChannel,
    commitments: [generatedCommitment],
  };
}

async function getCommitmentsFromChannel(channel: StateChannel, store: IStoreService) {
  const proposalCommitments = await Promise.all(
    [...channel.proposedAppInstances.values()].map((proposedApp) =>
      store.getSetStateCommitments(proposedApp.identityHash),
    ),
  );

  const installedCommitments = await Promise.all(
    [...channel.appInstances.values()].map((app) => store.getSetStateCommitments(app.identityHash)),
  );

  const freeBalanceCommitments = await store.getSetStateCommitments(
    channel.freeBalance.identityHash,
  )[0];

  return {
    proposalCommitments: proposalCommitments.map((commitment) => commitment[0]),
    installedCommitments: installedCommitments.map((commitment) => commitment[0]),
    freeBalanceCommitments,
  };
}

// will return true IFF there is information in our counterparty's channel
// we must update with. Will return false if the responder 
function needsSyncFromCounterparty(ourChannel: StateChannel, counterpartyChannel: StateChannel): boolean {
  // check channel nonces
  // covers interruptions in: propose
  if (ourChannel.numProposedApps < counterpartyChannel.numProposedApps) {
    return true;
  }

  // check free balance nonces
  // covers interruptions in: uninstall, install
  if (
    ourChannel.freeBalance.latestVersionNumber <
    counterpartyChannel.freeBalance.latestVersionNumber
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
    if (
      counterpartyCopy &&
      counterpartyCopy.latestVersionNumber > app.latestVersionNumber
    ) {
      needCounterpartyAppData = true;
    }
  });

  return needCounterpartyAppData;
}
