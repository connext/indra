import {
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  StateChannelJSON,
  SetStateCommitmentJSON,
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
import { getSetStateCommitment, SetStateCommitment } from "../ethereum";
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
    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );
    const m1 = {
      protocol,
      processID,
      params,
      seq: 1,
      to: responderIdentifier,
      customData: {
        channelJson: preProtocolStateChannel.toJson(),
      },
    } as ProtocolMessageData;

    substart = Date.now();

    // 200ms
    const m2 = yield [IO_SEND_AND_WAIT, m1];
    logTime(log, substart, `[${processID}] Received responder's m2`);
    substart = Date.now();

    const {
      data: {
        customData: { channelJson, proposalCommitments },
      },
    }: {
      data: {
        customData: {
          channelJson: StateChannelJSON;
          proposalCommitments: SetStateCommitmentJSON[];
        };
      };
    } = m2!;

    const responderChannel = StateChannel.fromJson(channelJson);

    if (
      preProtocolStateChannel.freeBalance.latestVersionNumber <
      responderChannel.freeBalance.latestVersionNumber
    ) {
      throw new Error("TODO: handle case where initiator free balance is out of sync");
    }

    let postProtocolStateChannel;
    let commitments: SetStateCommitment[] = [];
    if (preProtocolStateChannel.numProposedApps < responderChannel.numProposedApps) {
      if (responderChannel.numProposedApps - preProtocolStateChannel.numProposedApps !== 1) {
        throw new Error(`Cannot sync by more than one proposed app, use restore instead.`);
      }
      log.debug(`Channel numProposedApps is out of sync, attempting sync now`);
      const untrackedProposedApp = [...responderChannel.proposedAppInstances.values()].find(
        (app) => !preProtocolStateChannel.proposedAppInstances.has(app.identityHash),
      );
      if (!untrackedProposedApp) {
        throw new Error(`Cannot find matching proposal, aborting sync`);
      }
      const correspondingSetStateCommitment = proposalCommitments.find(
        (p) => p.appIdentityHash === untrackedProposedApp.identityHash,
      );
      if (!correspondingSetStateCommitment) {
        throw new Error(
          `No corresponding set state commitment for ${untrackedProposedApp.identityHash}`,
        );
      }
      const proposedAppInstance = {
        identity: {
          appDefinition: untrackedProposedApp.appDefinition,
          channelNonce: toBN(responderChannel.numProposedApps),
          participants: responderChannel.getSigningKeysFor(
            untrackedProposedApp.initiatorIdentifier,
            untrackedProposedApp.responderIdentifier,
          ),
          multisigAddress: preProtocolStateChannel.multisigAddress,
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
      const generatedCommitment = getSetStateCommitment(
        context,
        proposedAppInstance as AppInstance,
      );
      const signer1 = await recoverAddressFromChannelMessage(
        generatedCommitment.hashToSign(),
        correspondingSetStateCommitment.signatures[0],
      );
      const signer2 = await recoverAddressFromChannelMessage(
        generatedCommitment.hashToSign(),
        correspondingSetStateCommitment.signatures[1],
      );
      if (
        signer1 === getSignerAddressFromPublicIdentifier(initiatorIdentifier) ||
        signer2 === getSignerAddressFromPublicIdentifier(initiatorIdentifier)
      ) {
        postProtocolStateChannel = preProtocolStateChannel.addProposal(untrackedProposedApp);
        commitments.push(generatedCommitment);
      }
    } else {
      throw new Error("TODO: handle case where initiator is ahead of responder in sync");
    }

    if (!postProtocolStateChannel || commitments.length === 0) {
      throw new Error("Could not generate commitments or new channel using the sync protocol");
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
      customData: { channelJson: initiatorChannelJson },
    } = message;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    const proposalCommitments = await Promise.all(
      [...preProtocolStateChannel.proposedAppInstances.values()].map(async (proposedApp) =>
        store.getSetStateCommitments(proposedApp.identityHash),
      ),
    );

    substart = Date.now();

    const m1 = {
      protocol,
      processID,
      params,
      seq: UNASSIGNED_SEQ_NO,
      to: initiatorIdentifier,
      customData: {
        channelJson: preProtocolStateChannel.toJson(),
        proposalCommitments: proposalCommitments.map((commitment) => commitment[0]),
      },
    } as ProtocolMessageData;
    yield [IO_SEND, m1, preProtocolStateChannel];

    logTime(log, substart, `[${processID}] Response finished`);
    substart = Date.now();
  },
};
