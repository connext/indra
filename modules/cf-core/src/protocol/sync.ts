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
  getPublicKeyFromPublicIdentifier,
} from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { StateChannel, AppInstance } from "../models";
import { Context, ProtocolExecutionFlow } from "../types";

import { stateChannelClassFromStoreByMultisig, assertIsValidSignature } from "./utils";
import { getSetStateCommitment } from "../ethereum";
import { keccak256, defaultAbiCoder } from "ethers/utils";

const protocol = ProtocolNames.sync;
const { IO_SEND, IO_SEND_AND_WAIT } = Opcode;

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
    let preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
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
    console.log("channelJson: ", channelJson);

    if (
      preProtocolStateChannel.freeBalance.latestVersionNumber <
      responderChannel.freeBalance.latestVersionNumber
    ) {
      console.log(`Channel freeBalance is out of sync, attempting sync now`);
    }

    if (preProtocolStateChannel.numProposedApps < responderChannel.numProposedApps) {
      if (responderChannel.numProposedApps - preProtocolStateChannel.numProposedApps !== 1) {
        throw new Error(`Cannot sync by more than one proposed app, use restore instead.`);
      }
      console.log(`Channel numProposedApps is out of sync, attempting sync now`);
      const untrackedProposedApps = [...responderChannel.proposedAppInstances.values()].filter(
        (app) => !preProtocolStateChannel.proposedAppInstances.has(app.identityHash),
      );
      if (untrackedProposedApps.length !== 1) {
        throw new Error(`Cannot sync more than one proposed app`);
      }

      const [untrackedProposedApp] = untrackedProposedApps;
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
          channelNonce: toBN(responderChannel.numProposedApps + 1),
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
      console.log('generatedCommitment: ', generatedCommitment);
      const signer1 = await recoverAddressFromChannelMessage(
        generatedCommitment.hashToSign(),
        correspondingSetStateCommitment.signatures[0],
      );
      const signer2 = await recoverAddressFromChannelMessage(
        generatedCommitment.hashToSign(),
        correspondingSetStateCommitment.signatures[1],
      );
      // TODO: check counterparty sig
      console.log(
        "getSignerAddressFromPublicIdentifier(initiatorIdentifier): ",
        getSignerAddressFromPublicIdentifier(initiatorIdentifier),
      );
      console.log("signer1: ", signer1);
      console.log(
        "getSignerAddressFromPublicIdentifier(initiatorIdentifier): ",
        getSignerAddressFromPublicIdentifier(initiatorIdentifier),
      );
      console.log("signer2: ", signer2);
      if (
        signer1 === getSignerAddressFromPublicIdentifier(initiatorIdentifier) ||
        signer2 === getSignerAddressFromPublicIdentifier(initiatorIdentifier)
      ) {
        preProtocolStateChannel = preProtocolStateChannel.addProposal(untrackedProposedApp);
      }
    }

    console.log("POST SYNC CHANNEL: ", stringify(preProtocolStateChannel.toJson()));

    logTime(log, substart, `[${processID}] Response finished`);
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
    console.log("initiatorChannelJson: ", initiatorChannelJson);

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
    yield [IO_SEND, m1];

    logTime(log, substart, `[${processID}] Response finished`);
    substart = Date.now();
  },
};
