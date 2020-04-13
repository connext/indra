import {
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  SetupMiddlewareContext,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier } from "@connext/crypto";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetupCommitment, getSetStateCommitment } from "../ethereum";
import { StateChannel } from "../models";
import {
  Context,
  PersistCommitmentType,
  ProtocolExecutionFlow,
} from "../types";
import { logTime } from "../utils";

import { assertIsValidSignature } from "./utils";

const protocol = ProtocolNames.setup;
const {
  OP_SIGN,
  OP_VALIDATE,
  IO_SEND,
  IO_SEND_AND_WAIT,
  PERSIST_COMMITMENT,
  PERSIST_STATE_CHANNEL,
} = Opcode;
const { CreateSetup } = PersistCommitmentType;

/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/04-setup-protocol
 */
export const SETUP_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { message, network } = context;
    const log = context.log.newContext("CF-SetupProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Initiation started`);

    const { processID, params } = message;

    const {
      multisigAddress,
      responderIdentifier,
      initiatorIdentifier,
    } = params as ProtocolParams.Setup;

    yield [
      OP_VALIDATE,
      protocol,
      { params, role: ProtocolRoles.initiator } as SetupMiddlewareContext,
    ];

    // 56 ms
    const stateChannel = StateChannel.setupChannel(
      network.IdentityApp,
      { proxyFactory: network.ProxyFactory, multisigMastercopy: network.MinimumViableMultisig },
      multisigAddress,
      initiatorIdentifier,
      responderIdentifier,
    );

    const setupCommitment = getSetupCommitment(context, stateChannel);

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    // 32 ms
    const mySetupSignature = yield [OP_SIGN, setupCommitment.hashToSign()];

    // 32 ms
    const freeBalanceUpdateData = getSetStateCommitment(context, stateChannel.freeBalance);
    const mySignatureOnFreeBalanceState = yield [
      OP_SIGN,
      freeBalanceUpdateData.hashToSign(),
    ];

    // 201 ms (waits for responder to respond)
    substart = Date.now();
    const {
      customData: {
        setupSignature: responderSetupSignature,
        setStateSignature: responderSignatureOnFreeBalanceState,
      },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        seq: 1,
        to: responderIdentifier,
        customData: {
          setupSignature: mySetupSignature,
          setStateSignature: mySignatureOnFreeBalanceState,
        },
      } as ProtocolMessageData,
    ];
    logTime(log, substart, `Received responder's sigs`);

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    // 68 ms
    substart = Date.now();
    const responderAddr = getSignerAddressFromPublicIdentifier(responderIdentifier);
    await assertIsValidSignature(
      responderAddr,
      setupCommitment.hashToSign(),
      responderSetupSignature,
    );
    await assertIsValidSignature(
      responderAddr,
      freeBalanceUpdateData.hashToSign(),
      responderSignatureOnFreeBalanceState,
    );
    logTime(log, substart, `Verified responder's sigs`);

    // add sigs to commitments
    await setupCommitment.addSignatures(
      mySetupSignature as any,
      responderSetupSignature,
    );

    await freeBalanceUpdateData.addSignatures(
      mySignatureOnFreeBalanceState as any,
      responderSignatureOnFreeBalanceState,
    );
    // 33 ms
    yield [
      PERSIST_COMMITMENT,
      CreateSetup,
      await setupCommitment.getSignedTransaction(),
      stateChannel.multisigAddress,
    ];
    yield [PERSIST_STATE_CHANNEL, [stateChannel]];

    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.CreateSetState,
      freeBalanceUpdateData,
      stateChannel.freeBalance.identityHash,
    ];

    logTime(log, start, `Finished initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, network } = context;
    const log = context.log.newContext("CF-SetupProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Response started`);

    const {
      processID,
      params,
      customData: {
        setupSignature: initiatorSetupSignature,
        setStateSignature: initiatorSignatureOnFreeBalanceState,
      },
    } = message;

    const {
      multisigAddress,
      initiatorIdentifier,
      responderIdentifier,
    } = params as ProtocolParams.Setup;

    yield [
      OP_VALIDATE,
      protocol,
      { params, role: ProtocolRoles.responder } as SetupMiddlewareContext,
    ];

    // 73 ms
    const stateChannel = StateChannel.setupChannel(
      network.IdentityApp,
      { proxyFactory: network.ProxyFactory, multisigMastercopy: network.MinimumViableMultisig },
      multisigAddress,
      initiatorIdentifier,
      responderIdentifier,
    );

    const setupCommitment = getSetupCommitment(context, stateChannel);
    const freeBalanceUpdateData = getSetStateCommitment(context, stateChannel.freeBalance);

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    // 94 ms
    substart = Date.now();
    const initatorAddr = getSignerAddressFromPublicIdentifier(initiatorIdentifier);
    await assertIsValidSignature(
      initatorAddr,
      setupCommitment.hashToSign(),
      initiatorSetupSignature,
    );
    await assertIsValidSignature(
      initatorAddr,
      freeBalanceUpdateData.hashToSign(),
      initiatorSignatureOnFreeBalanceState,
    );
    logTime(log, substart, `Verified initator's sig`);

    // 49 ms
    const mySetupSignature = yield [OP_SIGN, setupCommitment.hashToSign()];
    const mySignatureOnFreeBalanceState = yield [OP_SIGN, freeBalanceUpdateData.hashToSign()];

    await setupCommitment.addSignatures(
      initiatorSetupSignature,
      mySetupSignature as any,
    );

    await freeBalanceUpdateData.addSignatures(
      initiatorSignatureOnFreeBalanceState,
      mySignatureOnFreeBalanceState as any,
    );

    yield [
      PERSIST_COMMITMENT,
      CreateSetup,
      await setupCommitment.getSignedTransaction(),
      stateChannel.multisigAddress,
    ];

    yield [PERSIST_STATE_CHANNEL, [stateChannel]];

    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.CreateSetState,
      freeBalanceUpdateData,
      stateChannel.freeBalance.identityHash,
    ];

    yield [
      IO_SEND,
      {
        protocol,
        processID,
        to: initiatorIdentifier,
        seq: UNASSIGNED_SEQ_NO,
        customData: {
          setupSignature: mySetupSignature,
          setStateSignature: mySignatureOnFreeBalanceState,
        },
      } as ProtocolMessageData,
    ];
    logTime(log, start, `Finished responding`);
  },
};
