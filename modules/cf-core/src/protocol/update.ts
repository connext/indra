import {
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  UpdateMiddlewareContext,
  getAddressFromIdentifier,
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
      responderIdentifier,
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

    const responderAddr = getAddressFromIdentifier(responderIdentifier);

    const setStateCommitment = getSetStateCommitment(context, appInstance);

    const mySignature = yield [
      OP_SIGN,
      setStateCommitment.hashToSign(),
    ];

    substart = Date.now();
    const {
      customData: { signature: counterpartySig },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        seq: 1,
        to: responderIdentifier,
        customData: {
          signature: mySignature,
        },
      } as ProtocolMessageData,
    ];
    logTime(log, substart, `Received responder's sig`);

    substart = Date.now();
    await assertIsValidSignature(
      responderAddr,
      setStateCommitment.hashToSign(),
      counterpartySig,
    );
    logTime(log, substart, `Verified responder's sig`);

    // add signatures and write commitment to store
    const isAppInitiator = appInstance.initiatorIdentifier !== responderIdentifier;
    await setStateCommitment.addSignatures(
      isAppInitiator
        ? mySignature as any
        : counterpartySig,
      isAppInitiator
        ? counterpartySig
        : mySignature as any,
    );

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
      customData: { signature: counterpartySig },
    } = message;

    const {
      appIdentityHash,
      multisigAddress,
      initiatorIdentifier,
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

    const initiatorAddr = getAddressFromIdentifier(initiatorIdentifier);

    const setStateCommitment = getSetStateCommitment(context, appInstance);

    substart = Date.now();
    await assertIsValidSignature(
      initiatorAddr,
      setStateCommitment.hashToSign(),
      counterpartySig,
    );
    logTime(log, substart, `Verified initator's sig`);

    const mySignature = yield [
      OP_SIGN,
      setStateCommitment.hashToSign(),
      appInstance.appSeqNo,
    ];

    // add signatures and write commitment to store
    const isAppInitiator = appInstance.initiatorIdentifier !== initiatorIdentifier;
    await setStateCommitment.addSignatures(
      isAppInitiator
        ? mySignature as any
        : counterpartySig,
      isAppInitiator
        ? counterpartySig
        : mySignature as any,
    );

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
        to: initiatorIdentifier,
        seq: UNASSIGNED_SEQ_NO,
        customData: {
          signature: mySignature,
        },
      } as ProtocolMessageData,
    ];
    logTime(log, start, `Finished responding`);
  },
};
