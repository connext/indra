import { PersistAppType } from "@connext/types";
import { defaultAbiCoder, keccak256 } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../constants";
import { xkeyKthAddress, Commitment, Opcode, Protocol, appIdentityToHash } from "../machine";
import { SetStateCommitment } from "../ethereum";
import { AppInstanceProposal } from "../models";
import {
  Context,
  ProposeInstallProtocolParams,
  ProtocolExecutionFlow,
  ProtocolMessage,
} from "../types";
import { logTime } from "../utils";

import { assertIsValidSignature, UNASSIGNED_SEQ_NO } from "./utils";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../methods";

const protocol = Protocol.Propose;
const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, PERSIST_COMMITMENT, PERSIST_APP_INSTANCE } = Opcode;
const { SetState } = Commitment;

export const PROPOSE_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { message, network, store } = context;
    const log = context.log.newContext("CF-ProposeProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Initiation started`);

    const { processID, params } = message;

    const {
      multisigAddress,
      initiatorXpub,
      responderXpub,
      appDefinition,
      abiEncodings,
      initiatorDeposit,
      initiatorDepositTokenAddress,
      responderDeposit,
      responderDepositTokenAddress,
      timeout,
      initialState,
      outcomeType,
    } = params as ProposeInstallProtocolParams;

    const preProtocolStateChannel = await store.getStateChannel(multisigAddress);

    const appInstanceProposal: AppInstanceProposal = {
      appDefinition,
      abiEncodings,
      initialState,
      outcomeType,
      initiatorDeposit: initiatorDeposit.toHexString(),
      responderDeposit: responderDeposit.toHexString(),
      timeout: timeout.toHexString(),
      identityHash: appIdentityToHash({
        appDefinition,
        channelNonce: preProtocolStateChannel.numProposedApps + 1,
        participants: preProtocolStateChannel.getSigningKeysFor(
          preProtocolStateChannel.numProposedApps + 1,
        ),
        defaultTimeout: timeout.toNumber(),
      }),
      proposedByIdentifier: initiatorXpub,
      proposedToIdentifier: responderXpub,
      appSeqNo: preProtocolStateChannel.numProposedApps + 1,
      initiatorDepositTokenAddress:
        initiatorDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      responderDepositTokenAddress:
        responderDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    };

    const postProtocolStateChannel = preProtocolStateChannel.addProposal(appInstanceProposal);

    const setStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      {
        appDefinition,
        channelNonce: preProtocolStateChannel.numProposedApps + 1,
        participants: preProtocolStateChannel.getSigningKeysFor(
          preProtocolStateChannel.numProposedApps + 1,
        ),
        defaultTimeout: timeout.toNumber(),
      },
      keccak256(defaultAbiCoder.encode([abiEncodings.stateEncoding], [initialState])),
      0,
      timeout.toNumber(),
    );

    const initiatorSignatureOnInitialState = yield [
      OP_SIGN,
      setStateCommitment,
      appInstanceProposal.appSeqNo,
    ];

    const m1 = {
      protocol,
      processID,
      params,
      seq: 1,
      toXpub: responderXpub,
      customData: {
        signature: initiatorSignatureOnInitialState,
      },
    } as ProtocolMessage;

    substart = Date.now();
    const m2 = yield [IO_SEND_AND_WAIT, m1];
    logTime(log, substart, `Received responder's m2`);

    const {
      customData: { signature: responderSignatureOnInitialState },
    } = m2! as ProtocolMessage;

    substart = Date.now();
    assertIsValidSignature(
      xkeyKthAddress(responderXpub, appInstanceProposal.appSeqNo),
      setStateCommitment,
      responderSignatureOnInitialState,
    );
    logTime(log, substart, `Validated responder's sig on initial state`);

    // add signatures to commitment and save
    setStateCommitment.signatures = [
      initiatorSignatureOnInitialState,
      responderSignatureOnInitialState,
    ];

    // will also save the app array into the state channel
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.Proposal,
      postProtocolStateChannel,
      appInstanceProposal,
    ];

    yield [PERSIST_COMMITMENT, SetState, setStateCommitment, appInstanceProposal.identityHash];

    logTime(log, start, `Finished Initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, network, store } = context;
    const log = context.log.newContext("CF-ProposeProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Response started`);

    const { params, processID } = message;

    const {
      multisigAddress,
      initiatorXpub,
      responderXpub,
      appDefinition,
      abiEncodings,
      initiatorDeposit,
      initiatorDepositTokenAddress,
      responderDeposit,
      responderDepositTokenAddress,
      timeout,
      initialState,
      outcomeType,
    } = params as ProposeInstallProtocolParams;

    const {
      customData: { signature: initiatorSignatureOnInitialState },
    } = message;

    const preProtocolStateChannel = await store.getStateChannel(multisigAddress);

    const appInstanceProposal: AppInstanceProposal = {
      appDefinition,
      abiEncodings,
      initialState,
      outcomeType,
      identityHash: appIdentityToHash({
        appDefinition,
        channelNonce: preProtocolStateChannel.numProposedApps + 1,
        participants: preProtocolStateChannel.getSigningKeysFor(
          preProtocolStateChannel.numProposedApps + 1,
        ),
        defaultTimeout: timeout.toNumber(),
      }),
      timeout: timeout.toHexString(),
      initiatorDeposit: responderDeposit.toHexString(),
      responderDeposit: initiatorDeposit.toHexString(),
      proposedByIdentifier: initiatorXpub,
      proposedToIdentifier: responderXpub,
      appSeqNo: preProtocolStateChannel.numProposedApps + 1,
      initiatorDepositTokenAddress:
        responderDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      responderDepositTokenAddress:
        initiatorDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    };

    const setStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      {
        appDefinition,
        channelNonce: preProtocolStateChannel.numProposedApps + 1,
        participants: preProtocolStateChannel.getSigningKeysFor(
          preProtocolStateChannel.numProposedApps + 1,
        ),
        defaultTimeout: timeout.toNumber(),
      },
      keccak256(defaultAbiCoder.encode([abiEncodings.stateEncoding], [initialState])),
      0,
      timeout.toNumber(),
    );

    const postProtocolStateChannel = preProtocolStateChannel.addProposal(appInstanceProposal);

    substart = Date.now();
    assertIsValidSignature(
      xkeyKthAddress(initiatorXpub, appInstanceProposal.appSeqNo),
      setStateCommitment,
      initiatorSignatureOnInitialState,
    );
    logTime(log, substart, `Validated initiator's sig on initial state`);

    const responderSignatureOnInitialState = yield [
      OP_SIGN,
      setStateCommitment,
      appInstanceProposal.appSeqNo,
    ];

    yield [
      IO_SEND,
      {
        protocol,
        processID,
        seq: UNASSIGNED_SEQ_NO,
        toXpub: initiatorXpub,
        customData: {
          signature: responderSignatureOnInitialState,
        },
      } as ProtocolMessage,
    ];

    setStateCommitment.signatures = [
      initiatorSignatureOnInitialState,
      responderSignatureOnInitialState,
    ];

    // will also save the app array into the state channel
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.Proposal,
      postProtocolStateChannel,
      appInstanceProposal,
    ];
    yield [PERSIST_COMMITMENT, SetState, setStateCommitment, appInstanceProposal.identityHash];
    logTime(log, start, `Finished responding`);
  },
};
