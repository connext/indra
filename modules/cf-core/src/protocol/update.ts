import {
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  UpdateMiddlewareContext,
} from "@connext/types";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { logTime } from "../utils";
import {
  Context,
  PersistAppType,
  PersistCommitmentType,
  ProtocolExecutionFlow,
} from "../types";
import { xkeyKthAddress } from "../xkeys";

import { assertIsValidSignature, stateChannelClassFromStoreByMultisig } from "./utils";

const protocol = ProtocolNames.update;
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
 * specs.counterfactual.com/07-update-protocol#messages
 *
 */
export const UPDATE_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Intiating */: async function*(context: Context) {
    const { store, message } = context;
    const log = context.log.newContext("CF-UpdateProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Initiation started`);

    const { processID, params } = message;

    const {
      appIdentityHash,
      multisigAddress,
      responderXpub,
      newState,
      stateTimeout,
    } = params as ProtocolParams.Update;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );
    const preProtocolAppInstance = preProtocolStateChannel.getAppInstance(appIdentityHash);

    yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: preProtocolAppInstance.toJson(),
        role: ProtocolRoles.initiator,
      } as UpdateMiddlewareContext,
    ];


    const postProtocolStateChannel = preProtocolStateChannel.setState(
      preProtocolAppInstance,
      newState,
      stateTimeout,
    );

    const appInstance = postProtocolStateChannel.getAppInstance(appIdentityHash);

    const responderEphemeralKey = xkeyKthAddress(responderXpub, appInstance.appSeqNo);

    const setStateCommitment = getSetStateCommitment(context, appInstance);

    const initiatorSignature = yield [
      OP_SIGN,
      setStateCommitment.hashToSign(),
      appInstance.appSeqNo,
    ];

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
      } as ProtocolMessageData,
    ];
    logTime(log, substart, `Received responder's sig`);

    substart = Date.now();
    await assertIsValidSignature(
      responderEphemeralKey,
      setStateCommitment.hashToSign(),
      responderSignature,
    );
    logTime(log, substart, `Verified responder's sig`);

    setStateCommitment.signatures = [initiatorSignature, responderSignature];

    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.UpdateSetState,
      setStateCommitment,
      appIdentityHash,
    ];

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.UpdateInstance,
      postProtocolStateChannel,
      appInstance,
    ];
    logTime(log, start, `Finished Initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { store, message } = context;
    const log = context.log.newContext("CF-UpdateProtocol");
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
      newState,
      stateTimeout,
    } = params as ProtocolParams.Update;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );
    const preProtocolAppInstance = preProtocolStateChannel.getAppInstance(appIdentityHash);

    yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: preProtocolAppInstance.toJson(),
        role: ProtocolRoles.responder,
      } as UpdateMiddlewareContext,
    ];

    const postProtocolStateChannel = preProtocolStateChannel.setState(
      preProtocolAppInstance,
      newState,
      stateTimeout,
    );

    const appInstance = postProtocolStateChannel.getAppInstance(appIdentityHash);

    const initiatorEphemeralKey = xkeyKthAddress(initiatorXpub, appInstance.appSeqNo);

    const setStateCommitment = getSetStateCommitment(context, appInstance);

    substart = Date.now();
    await assertIsValidSignature(
      initiatorEphemeralKey,
      setStateCommitment.hashToSign(),
      initiatorSignature,
    );
    logTime(log, substart, `Verified initator's sig`);

    const responderSignature = yield [
      OP_SIGN,
      setStateCommitment.hashToSign(),
      appInstance.appSeqNo,
    ];

    setStateCommitment.signatures = [initiatorSignature, responderSignature];

    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.UpdateSetState,
      setStateCommitment,
      appIdentityHash,
    ];

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.UpdateInstance,
      postProtocolStateChannel,
      appInstance,
    ];

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
      } as ProtocolMessageData,
    ];
    logTime(log, start, `Finished responding`);
  },
};
