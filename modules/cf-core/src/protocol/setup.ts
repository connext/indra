import {
  Opcode,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  SetupMiddlewareContext,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, logTime, stringify } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetupCommitment, getSetStateCommitment } from "../ethereum";
import { StateChannel } from "../models";
import { Context, ProtocolExecutionFlow, PersistStateChannelType } from "../types";

import { assertIsValidSignature, parseProtocolMessage, generateProtocolMessageData } from "./utils";

const protocol = ProtocolNames.setup;
const { OP_SIGN, OP_VALIDATE, IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL } = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/04-setup-protocol
 */
export const SETUP_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const { message, networks } = context;
    const log = context.log.newContext("CF-SetupProtocol");
    const start = Date.now();
    let substart: number;
    const { processID, params } = message.data;
    const loggerId = params?.multisigAddress || processID;
    log.info(`[${loggerId}] Initiation started`);
    log.debug(`[${loggerId}] Protocol initiated with parameters ${stringify(params)}`);

    const {
      multisigAddress,
      responderIdentifier,
      initiatorIdentifier,
      chainId,
    } = params as ProtocolParams.Setup;

    const error = yield [
      OP_VALIDATE,
      protocol,
      { params, role: ProtocolRoles.initiator } as SetupMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }

    // 56 ms
    const network = networks[chainId];
    const stateChannel = StateChannel.setupChannel(
      network.contractAddresses.IdentityApp,
      network.contractAddresses,
      multisigAddress,
      chainId,
      initiatorIdentifier,
      responderIdentifier,
    );

    const setupCommitment = getSetupCommitment(network, stateChannel);

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    // 32 ms
    const mySetupSignature = yield [OP_SIGN, setupCommitment.hashToSign()];

    // 32 ms
    const freeBalanceUpdateData = getSetStateCommitment(network, stateChannel.freeBalance);
    const mySignatureOnFreeBalanceState = yield [OP_SIGN, freeBalanceUpdateData.hashToSign()];

    // 201 ms (waits for responder to respond)
    substart = Date.now();
    const { message: m2 } = yield [
      IO_SEND_AND_WAIT,
      generateProtocolMessageData(responderIdentifier, protocol, processID, 1, params, {
        prevMessageReceived: start,
        customData: {
          setupSignature: mySetupSignature,
          setStateSignature: mySignatureOnFreeBalanceState,
        },
      }),
    ];
    logTime(log, substart, `[${loggerId}] Received responder's sigs`);
    const {
      data: {
        customData: {
          setupSignature: responderSetupSignature,
          setStateSignature: responderSignatureOnFreeBalanceState,
        },
      },
    } = parseProtocolMessage(m2);

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
    logTime(log, substart, `[${loggerId}] Verified responder's sigs`);

    // add sigs to commitments
    await setupCommitment.addSignatures(mySetupSignature as any, responderSetupSignature);

    await freeBalanceUpdateData.addSignatures(
      mySignatureOnFreeBalanceState as any,
      responderSignatureOnFreeBalanceState,
    );

    yield [
      PERSIST_STATE_CHANNEL,
      PersistStateChannelType.CreateChannel,
      stateChannel,
      [await setupCommitment.getSignedTransaction(), freeBalanceUpdateData],
    ];

    logTime(log, start, `[${loggerId}] Initiation finished`);
  } as any,

  1 /* Responding */: async function* (context: Context) {
    const { message, networks } = context;
    const log = context.log.newContext("CF-SetupProtocol");
    const start = Date.now();
    let substart = start;
    const {
      processID,
      params,
      customData: {
        setupSignature: initiatorSetupSignature,
        setStateSignature: initiatorSignatureOnFreeBalanceState,
      },
    } = message.data;
    const loggerId = params?.multisigAddress || processID;
    log.info(`[${loggerId}] Response started`);
    log.debug(`[${loggerId}] Protocol response started with parameters ${stringify(params)}`);

    const {
      multisigAddress,
      chainId,
      initiatorIdentifier,
      responderIdentifier,
    } = params as ProtocolParams.Setup;

    const error = yield [
      OP_VALIDATE,
      protocol,
      { params, role: ProtocolRoles.responder } as SetupMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }

    const network = networks[chainId];
    // 73 ms
    const stateChannel = StateChannel.setupChannel(
      network.contractAddresses.IdentityApp,
      network.contractAddresses,
      multisigAddress,
      chainId,
      initiatorIdentifier,
      responderIdentifier,
    );

    const setupCommitment = getSetupCommitment(network, stateChannel);
    const freeBalanceUpdateData = getSetStateCommitment(network, stateChannel.freeBalance);

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    // 94 ms
    // eslint-disable-next-line prefer-const
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
    logTime(log, substart, `[${loggerId}] Verified initator's sig`);

    // 49 ms
    const mySetupSignature = yield [OP_SIGN, setupCommitment.hashToSign()];
    const mySignatureOnFreeBalanceState = yield [OP_SIGN, freeBalanceUpdateData.hashToSign()];

    await setupCommitment.addSignatures(initiatorSetupSignature, mySetupSignature as any);

    await freeBalanceUpdateData.addSignatures(
      initiatorSignatureOnFreeBalanceState,
      mySignatureOnFreeBalanceState as any,
    );

    yield [
      PERSIST_STATE_CHANNEL,
      PersistStateChannelType.CreateChannel,
      stateChannel,
      [await setupCommitment.getSignedTransaction(), freeBalanceUpdateData],
    ];

    yield [
      IO_SEND,
      generateProtocolMessageData(
        initiatorIdentifier,
        protocol,
        processID,
        UNASSIGNED_SEQ_NO,
        params,
        {
          prevMessageReceived: start,
          customData: {
            setupSignature: mySetupSignature,
            setStateSignature: mySignatureOnFreeBalanceState,
          },
        },
      ),
      stateChannel,
    ];

    logTime(log, start, `[${loggerId}] Response finished`);
  },
};
