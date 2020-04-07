import { ProtocolNames, ProtocolParams, ProtocolRoles, ProposeMiddlewareContext } from "@connext/types";
import { defaultAbiCoder, keccak256, bigNumberify } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS, UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { AppInstance, AppInstanceProposal } from "../models";
import {
  Context,
  Opcode,
  ProtocolExecutionFlow,
  ProtocolMessage,
  PersistAppType,
  PersistCommitmentType,
} from "../types";
import { appIdentityToHash, logTime } from "../utils";
import { xkeyKthAddress } from "../xkeys";

import { assertIsValidSignature, stateChannelClassFromStoreByMultisig } from "./utils";

const protocol = ProtocolNames.propose;
const {
  OP_SIGN,
  OP_VALIDATE,
  IO_SEND,
  IO_SEND_AND_WAIT,
  PERSIST_APP_INSTANCE,
  PERSIST_COMMITMENT,
} = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 */
export const PROPOSE_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { message, store } = context;
    const log = context.log.newContext("CF-ProposeProtocol");
    const start = Date.now();
    let substart = start;
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
      meta,
    } = params as ProtocolParams.Propose;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    // 7ms
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
        channelNonce: bigNumberify(preProtocolStateChannel.numProposedApps + 1).toString(),
        participants: preProtocolStateChannel.getSigningKeysFor(
          initiatorXpub,
          responderXpub,
          preProtocolStateChannel.numProposedApps + 1,
        ),
        multisigAddress: preProtocolStateChannel.multisigAddress,
        defaultTimeout: timeout.toString(),
      }),
      proposedByIdentifier: initiatorXpub,
      proposedToIdentifier: responderXpub,
      appSeqNo: preProtocolStateChannel.numProposedApps + 1,
      initiatorDepositTokenAddress:
        initiatorDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      responderDepositTokenAddress:
        responderDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      meta,
    };

    yield [
      OP_VALIDATE,
      protocol,
      {
        proposal: appInstanceProposal,
        params, role: ProtocolRoles.initiator,
      } as ProposeMiddlewareContext,
    ];

    // 0 ms
    const postProtocolStateChannel = preProtocolStateChannel.addProposal(appInstanceProposal);

    const proposedAppInstance = {
      identity: {
        appDefinition,
        channelNonce: (preProtocolStateChannel.numProposedApps + 1).toString(),
        participants: preProtocolStateChannel.getSigningKeysFor(
          initiatorXpub,
          responderXpub,
          preProtocolStateChannel.numProposedApps + 1,
        ),
        multisigAddress: preProtocolStateChannel.multisigAddress,
        defaultTimeout: timeout.toString(),
      },
      hashOfLatestState: keccak256(
        defaultAbiCoder.encode([abiEncodings.stateEncoding], [initialState]),
      ),
      versionNumber: 0,
      timeout: timeout.toNumber(),
    };

    const setStateCommitment = getSetStateCommitment(context, proposedAppInstance as AppInstance);

    substart = Date.now();
    // 6ms
    const initiatorSignatureOnInitialState = yield [
      OP_SIGN,
      setStateCommitment.hashToSign(),
      appInstanceProposal.appSeqNo,
    ];
    logTime(log, substart, `Signed initial state initiator propose`);

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

    // 200ms
    const m2 = yield [IO_SEND_AND_WAIT, m1];
    logTime(log, substart, `Received responder's m2`);
    substart = Date.now();

    const {
      customData: { signature: responderSignatureOnInitialState },
    } = m2! as ProtocolMessage;

    substart = Date.now();
    await assertIsValidSignature(
      xkeyKthAddress(responderXpub, appInstanceProposal.appSeqNo),
      setStateCommitment.hashToSign(),
      responderSignatureOnInitialState,
    );
    logTime(log, substart, `Asserted valid signture initiator propose`);

    // add signatures to commitment and save
    setStateCommitment.signatures = [
      initiatorSignatureOnInitialState,
      responderSignatureOnInitialState,
    ];

    substart = Date.now();

    // 78 ms(!)
    // will also save the app array into the state channel
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateProposal,
      postProtocolStateChannel,
      appInstanceProposal,
    ];
    logTime(log, substart, `Persisted app instance`);
    substart = Date.now();

    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.CreateSetState,
      setStateCommitment,
      appInstanceProposal.identityHash,
    ];

    // Total 298ms
    logTime(log, start, `Finished Initiating proposal`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, store } = context;
    const log = context.log.newContext("CF-ProposeProtocol");
    const start = Date.now();
    let substart = start;
    log.warn(`Response started`);

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
      meta,
    } = params as ProtocolParams.Propose;

    const {
      customData: { signature: initiatorSignatureOnInitialState },
    } = message;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    // 16ms
    const appInstanceProposal: AppInstanceProposal = {
      appDefinition,
      abiEncodings,
      initialState,
      outcomeType,
      identityHash: appIdentityToHash({
        appDefinition,
        channelNonce: (preProtocolStateChannel.numProposedApps + 1).toString(),
        participants: preProtocolStateChannel.getSigningKeysFor(
          initiatorXpub,
          responderXpub,
          preProtocolStateChannel.numProposedApps + 1,
        ),
        multisigAddress: preProtocolStateChannel.multisigAddress,
        defaultTimeout: timeout.toString(),
      }),
      timeout: timeout.toHexString(),
      initiatorDeposit: responderDeposit.toHexString(),
      responderDeposit: initiatorDeposit.toHexString(),
      proposedByIdentifier: initiatorXpub,
      proposedToIdentifier: responderXpub,
      meta,
      appSeqNo: preProtocolStateChannel.numProposedApps + 1,
      initiatorDepositTokenAddress:
        responderDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      responderDepositTokenAddress:
        initiatorDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    };

    yield [
      OP_VALIDATE,
      protocol,
      {
        proposal: appInstanceProposal,
        params, role: ProtocolRoles.responder,
      } as ProposeMiddlewareContext,
    ];

    const proposedAppInstance = {
      identity: {
        appDefinition,
        channelNonce: (preProtocolStateChannel.numProposedApps + 1).toString(),
        participants: preProtocolStateChannel.getSigningKeysFor(
          initiatorXpub,
          responderXpub,
          preProtocolStateChannel.numProposedApps + 1,
        ),
        multisigAddress: preProtocolStateChannel.multisigAddress,
        defaultTimeout: timeout.toString(),
      },
      hashOfLatestState: keccak256(
        defaultAbiCoder.encode([abiEncodings.stateEncoding], [initialState]),
      ),
      versionNumber: 0,
      timeout: timeout.toNumber(),
    };

    const setStateCommitment = getSetStateCommitment(context, proposedAppInstance as AppInstance);

    // 0ms
    const postProtocolStateChannel = preProtocolStateChannel.addProposal(appInstanceProposal);

    substart = Date.now();
    await assertIsValidSignature(
      xkeyKthAddress(initiatorXpub, appInstanceProposal.appSeqNo),
      setStateCommitment.hashToSign(),
      initiatorSignatureOnInitialState,
    );
    logTime(log, substart, `asserted valid signature responder propose`);

    substart = Date.now();
    // 12ms
    const responderSignatureOnInitialState = yield [
      OP_SIGN,
      setStateCommitment.hashToSign(),
      appInstanceProposal.appSeqNo,
    ];
    logTime(log, substart, `Signed initial state responder propose`);

    // 0ms
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

    substart = Date.now();

    // 98ms
    // will also save the app array into the state channel
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateProposal,
      postProtocolStateChannel,
      appInstanceProposal,
    ];
    logTime(log, substart, `Persisted app instance`);
    substart = Date.now();

    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.CreateSetState,
      setStateCommitment,
      appInstanceProposal.identityHash,
    ];
    logTime(log, start, `Finished responding`);
  },
};
