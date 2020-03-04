import { SetStateCommitment } from "../ethereum";
import { Opcode, Protocol, xkeyKthAddress } from "../machine";
import {
  Context,
  ProtocolExecutionFlow,
  ProtocolMessage,
  TakeActionProtocolParams,
} from "../types";
import { logTime } from "../utils";

import { assertIsValidSignature, UNASSIGNED_SEQ_NO } from "./utils";

const protocol = Protocol.TakeAction;
const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL } = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 * TODO: write a todo message here
 *
 */
export const TAKE_ACTION_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { stateChannelsMap, provider, message, network } = context;
    const log = context.log.newContext("CF-TakeActionProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Initiation started`);

    const { processID, params } = message;

    const {
      appIdentityHash,
      multisigAddress,
      responderXpub,
      action,
    } = params as TakeActionProtocolParams;

    const preProtocolStateChannel = stateChannelsMap.get(multisigAddress)!;

    const postProtocolStateChannel = preProtocolStateChannel.setState(
      appIdentityHash,
      await preProtocolStateChannel
        .getAppInstance(appIdentityHash)
        .computeStateTransition(action, provider),
    );

    const appInstance = postProtocolStateChannel.getAppInstance(appIdentityHash);

    const responderEphemeralKey = xkeyKthAddress(responderXpub, appInstance.appSeqNo);

    const setStateCommitment = new SetStateCommitment(
      network,
      appInstance.identity,
      appInstance.hashOfLatestState,
      appInstance.versionNumber,
      appInstance.timeout,
    );

    const initiatorSignature = yield [OP_SIGN, setStateCommitment, appInstance.appSeqNo];

    substart = Date.now();
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
    logTime(log, substart, `Received responder's sig`);

    substart = Date.now();
    assertIsValidSignature(responderEphemeralKey, setStateCommitment, responderSignature);
    logTime(log, substart, `Verified responder's sig`);

    yield [PERSIST_STATE_CHANNEL, [postProtocolStateChannel]];

    context.stateChannelsMap.set(
      postProtocolStateChannel.multisigAddress,
      postProtocolStateChannel,
    );
    logTime(log, start, `Finished Initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { stateChannelsMap, provider, message, network } = context;
    const log = context.log.newContext("CF-TakeActionProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Response started`);

    const {
      processID,
      params,
      customData: { signature: initiatorSignature },
    } = message;

    const {
      appIdentityHash,
      multisigAddress,
      initiatorXpub,
      action,
    } = params as TakeActionProtocolParams;

    const preProtocolStateChannel = stateChannelsMap.get(multisigAddress)!;

    const postProtocolStateChannel = preProtocolStateChannel.setState(
      appIdentityHash,
      await preProtocolStateChannel
        .getAppInstance(appIdentityHash)
        .computeStateTransition(action, provider),
    );

    const appInstance = postProtocolStateChannel.getAppInstance(appIdentityHash);

    const initiatorEphemeralKey = xkeyKthAddress(initiatorXpub, appInstance.appSeqNo);

    const setStateCommitment = new SetStateCommitment(
      network,
      appInstance.identity,
      appInstance.hashOfLatestState,
      appInstance.versionNumber,
      appInstance.timeout,
    );

    substart = Date.now();
    assertIsValidSignature(initiatorEphemeralKey, setStateCommitment, initiatorSignature);
    logTime(log, substart, `Verified initator's sig`);

    const responderSignature = yield [OP_SIGN, setStateCommitment, appInstance.appSeqNo];

    yield [PERSIST_STATE_CHANNEL, [postProtocolStateChannel]];

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

    context.stateChannelsMap.set(
      postProtocolStateChannel.multisigAddress,
      postProtocolStateChannel,
    );
    logTime(log, start, `Finished responding`);
  },
};
