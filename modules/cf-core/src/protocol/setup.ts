import { SetupCommitment } from "../ethereum";
import { ProtocolExecutionFlow, xkeyKthAddress } from "../machine";
import { Opcode, Protocol } from "../machine/enums";
import { StateChannel } from "../models/state-channel";
import { Context, ProtocolMessage, SetupProtocolParams } from "../types";
import { logTime } from "../utils";

import { UNASSIGNED_SEQ_NO } from "./utils/signature-forwarder";
import { assertIsValidSignature } from "./utils/signature-validator";

const protocol = Protocol.Setup;
const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL } = Opcode;

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

    const { processID, params } = message;

    const { multisigAddress, responderXpub, initiatorXpub } = params as SetupProtocolParams;

    // 56 ms
    const stateChannel = StateChannel.setupChannel(
      network.IdentityApp,
      { proxyFactory: network.ProxyFactory, multisigMastercopy: network.MinimumViableMultisig },
      multisigAddress,
      [initiatorXpub, responderXpub],
    );

    const setupCommitment = new SetupCommitment(
      network,
      stateChannel.multisigAddress,
      stateChannel.multisigOwners,
      stateChannel.freeBalance.identity,
    );

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    // 32 ms
    const initiatorSignature = yield [OP_SIGN, setupCommitment];

    // 201 ms (waits for responder to respond)
    const {
      customData: { signature: responderSignature },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        seq: 1,
        toXpub: responderXpub,
        customData: {
          signature: initiatorSignature,
        },
      } as ProtocolMessage,
    ];

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    // 34 ms
    assertIsValidSignature(xkeyKthAddress(responderXpub, 0), setupCommitment, responderSignature);

    // 33 ms
    yield [PERSIST_STATE_CHANNEL, [stateChannel]];

    context.stateChannelsMap.set(stateChannel.multisigAddress, stateChannel);
    logTime(log, start, `Finished initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, network } = context;
    const log = context.log.newContext("CF-SetupProtocol");
    const start = Date.now();

    const {
      processID,
      params,
      customData: { signature: initiatorSignature },
    } = message;

    const { multisigAddress, initiatorXpub, responderXpub } = params as SetupProtocolParams;

    // 73 ms
    const stateChannel = StateChannel.setupChannel(
      network.IdentityApp,
      { proxyFactory: network.ProxyFactory, multisigMastercopy: network.MinimumViableMultisig },
      multisigAddress,
      [initiatorXpub, responderXpub],
    );

    const setupCommitment = new SetupCommitment(
      network,
      stateChannel.multisigAddress,
      stateChannel.multisigOwners,
      stateChannel.freeBalance.identity,
    );

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    assertIsValidSignature(xkeyKthAddress(initiatorXpub, 0), setupCommitment, initiatorSignature);

    // setup installs the free balance app, and on creation the state channel
    // will have nonce 1, so use hardcoded 0th key
    // 94 ms
    assertIsValidSignature(xkeyKthAddress(initiatorXpub, 0), setupCommitment, initiatorSignature);

    // 49 ms
    const responderSignature = yield [OP_SIGN, setupCommitment];

    yield [PERSIST_STATE_CHANNEL, [stateChannel]];

    yield [
      IO_SEND,
      {
        protocol,
        processID,
        toXpub: initiatorXpub,
        seq: UNASSIGNED_SEQ_NO,
        customData: {
          signature: responderSignature,
        },
      } as ProtocolMessage,
    ];

    context.stateChannelsMap.set(stateChannel.multisigAddress, stateChannel);
    logTime(log, start, `Finished responding`);
  },
};
