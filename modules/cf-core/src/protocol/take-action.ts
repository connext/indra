import {
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  TakeActionMiddlewareContext,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, logTime } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import {
  Context,
  PersistAppType,
  PersistCommitmentType,
  ProtocolExecutionFlow,
} from "../types";

import { assertIsValidSignature, stateChannelClassFromStoreByMultisig } from "./utils";

const protocol = ProtocolNames.takeAction;
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
 * TODO: write a todo message here
 *
 */
export const TAKE_ACTION_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { store, message, network } = context;
    const log = context.log.newContext("CF-TakeActionProtocol");
    const start = Date.now();
    log.info(`Initiation started`);

    const { processID, params } = message;

    const {
      appIdentityHash,
      multisigAddress,
      responderIdentifier,
      action,
      stateTimeout,
    } = params as ProtocolParams.TakeAction;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );
    // 8ms
    const preAppInstance = preProtocolStateChannel.getAppInstance(appIdentityHash);

    yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: preAppInstance.toJson(),
        role: ProtocolRoles.initiator,
      } as TakeActionMiddlewareContext,
    ];

    // 40ms
    let substart = Date.now();
    const postProtocolStateChannel = preProtocolStateChannel.setState(
      preAppInstance,
      await preAppInstance.computeStateTransition(action, network.provider),
      stateTimeout,
    );
    logTime(log, substart, `SetState called in takeAction initiating`);

    // 0ms
    const appInstance = postProtocolStateChannel.getAppInstance(appIdentityHash);

    // 0ms
    const responderAddr = getSignerAddressFromPublicIdentifier(responderIdentifier);

    const setStateCommitment = getSetStateCommitment(context, appInstance);
    const setStateCommitmentHash = setStateCommitment.hashToSign();

    // 6ms
    const mySignature = yield [OP_SIGN, setStateCommitmentHash];

    // 117ms
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

    // 10ms
    await assertIsValidSignature(responderAddr, setStateCommitmentHash, counterpartySig);

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
      PERSIST_APP_INSTANCE,
      PersistAppType.UpdateInstance,
      postProtocolStateChannel,
      appInstance,
      setStateCommitment,
    ];

    // deprecated
    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.UpdateSetState,
      setStateCommitment,
      appIdentityHash,
    ];
    logTime(log, start, `Finished Initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { store, message, network } = context;
    const log = context.log.newContext("CF-TakeActionProtocol");
    const start = Date.now();
    log.debug(`Response started for takeAction`);

    const {
      processID,
      params,
      customData: { signature: counterpartySignature },
    } = message;

    const {
      appIdentityHash,
      multisigAddress,
      initiatorIdentifier,
      action,
      stateTimeout,
    } = params as ProtocolParams.TakeAction;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    // 9ms
    const preAppInstance = preProtocolStateChannel.getAppInstance(appIdentityHash);

    yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: preAppInstance.toJson(),
        role: ProtocolRoles.responder,
      } as TakeActionMiddlewareContext,
    ];

    // 48ms
    const postProtocolStateChannel = preProtocolStateChannel.setState(
      preAppInstance,
      await preAppInstance.computeStateTransition(action, network.provider),
      stateTimeout,
    );

    // 0ms
    const appInstance = postProtocolStateChannel.getAppInstance(appIdentityHash);

    // 0ms
    const initiatorAddr = getSignerAddressFromPublicIdentifier(initiatorIdentifier);

    const setStateCommitment = getSetStateCommitment(context, appInstance);
    const setStateCommitmentHash = setStateCommitment.hashToSign();

    // 9ms
    await assertIsValidSignature(initiatorAddr, setStateCommitmentHash, counterpartySignature);

    // 7ms
    const mySignature = yield [OP_SIGN, setStateCommitmentHash];

    // add signatures and write commitment to store
    const isAppInitiator = appInstance.initiatorIdentifier !== initiatorIdentifier;
    await setStateCommitment.addSignatures(
      isAppInitiator
        ? mySignature as any
        : counterpartySignature,
      isAppInitiator
        ? counterpartySignature
        : mySignature as any,
    );

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.UpdateInstance,
      postProtocolStateChannel,
      appInstance,
      setStateCommitment,
    ];

    // deprecated
    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.UpdateSetState,
      setStateCommitment,
      appIdentityHash,
    ];

    // 0ms
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

    // 149ms
    logTime(log, start, `Finished responding to takeAction`);
  },
};
