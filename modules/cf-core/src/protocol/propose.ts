import { defaultAbiCoder, keccak256 } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../constants";
import { appIdentityToHash, SetStateCommitment } from "../ethereum";
import { xkeyKthAddress } from "../machine";
import { Opcode, Protocol } from "../machine/enums";
import {
  Context,
  ProposeInstallProtocolParams,
  ProtocolExecutionFlow,
  ProtocolMessage,
} from "../types";
import { AppInstanceProposal, StateChannel } from "../models";
import { logTime } from "../utils";

import { UNASSIGNED_SEQ_NO } from "./utils/signature-forwarder";
import { assertIsValidSignature } from "./utils/signature-validator";

const protocol = Protocol.Propose;
const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL } = Opcode;

export const PROPOSE_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { message, network, stateChannelsMap } = context;
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

    const preProtocolStateChannel = stateChannelsMap.get(multisigAddress)
      ? stateChannelsMap.get(multisigAddress)!
      : StateChannel.createEmptyChannel(
          multisigAddress,
          { proxyFactory: network.ProxyFactory, multisigMastercopy: network.MinimumViableMultisig },
          [initiatorXpub, responderXpub],
        );

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

    yield [PERSIST_STATE_CHANNEL, [postProtocolStateChannel]];

    const setStateCommitment = new SetStateCommitment(
      network,
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

    context.stateChannelsMap.set(
      postProtocolStateChannel.multisigAddress,
      postProtocolStateChannel,
    );
    logTime(log, start, `Finished Initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, network, stateChannelsMap } = context;
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

    const preProtocolStateChannel = stateChannelsMap.get(multisigAddress)
      ? stateChannelsMap.get(multisigAddress)!
      : StateChannel.createEmptyChannel(
          multisigAddress,
          { proxyFactory: network.ProxyFactory, multisigMastercopy: network.MinimumViableMultisig },
          [initiatorXpub, responderXpub],
        );

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
      network,
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

    yield [PERSIST_STATE_CHANNEL, [postProtocolStateChannel]];

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

    context.stateChannelsMap.set(
      postProtocolStateChannel.multisigAddress,
      postProtocolStateChannel,
    );
    logTime(log, start, `Finished responding`);
  },
};
