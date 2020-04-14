import {
  ILoggerService,
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  UninstallMiddlewareContext,
} from "@connext/types";
import { JsonRpcProvider } from "ethers/providers";
import { getSignerAddressFromPublicIdentifier, logTime } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { AppInstance, StateChannel } from "../models";
import {
  Context,
  PersistAppType,
  PersistCommitmentType,
  ProtocolExecutionFlow,
} from "../types";

import {
  assertIsValidSignature,
  computeTokenIndexedFreeBalanceIncrements,
  stateChannelClassFromStoreByMultisig,
} from "./utils";


const protocol = ProtocolNames.uninstall;
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
 * specs.counterfactual.com/06-uninstall-protocol#messages
 */
export const UNINSTALL_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { message, store, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    log.debug(`Initiation started for uninstall`);

    const { params, processID } = message;
    const {
      responderIdentifier,
      appIdentityHash,
      multisigAddress,
    } = params as ProtocolParams.Uninstall;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: appToUninstall.toJson(),
        role: ProtocolRoles.initiator,
        stateChannel: preProtocolStateChannel.toJson(),
      } as UninstallMiddlewareContext,
    ];

    // 47ms
    const postProtocolStateChannel = await computeStateTransition(
      params as ProtocolParams.Uninstall,
      network.provider,
      preProtocolStateChannel,
      appToUninstall,
      log,
    );

    // 0ms
    const responderFreeBalanceKey = getSignerAddressFromPublicIdentifier(responderIdentifier);

    const uninstallCommitment = getSetStateCommitment(
      context,
      postProtocolStateChannel.freeBalance,
    );
    const uninstallCommitmentHash = uninstallCommitment.hashToSign();

    let checkpoint = Date.now();
    // 4ms
    const mySignature = yield [OP_SIGN, uninstallCommitmentHash];
    logTime(log, checkpoint, `Signed uninstall commitment initiator`);

    // 94ms
    const {
      customData: { signature: counterpartySignature },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        to: responderIdentifier,
        customData: { signature: mySignature },
        seq: 1,
      } as ProtocolMessageData,
    ];

    checkpoint = Date.now();
    // 6ms
    await assertIsValidSignature(
      responderFreeBalanceKey,
      uninstallCommitmentHash,
      counterpartySignature,
    );
    logTime(log, checkpoint, `Asserted valid signature in initiating uninstall`);

    const isInitiator = postProtocolStateChannel
      .multisigOwners[0] !== responderFreeBalanceKey;
    // use channel initiator bc free balance app
    await uninstallCommitment.addSignatures(
      isInitiator 
        ? mySignature as any
        : counterpartySignature,
      isInitiator
        ? counterpartySignature
        : mySignature as any,
    );

    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.UpdateSetState,
      uninstallCommitment,
      postProtocolStateChannel.freeBalance.identityHash,
    ];

    // 24ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.RemoveInstance,
      postProtocolStateChannel,
      appToUninstall,
    ];

    // 204ms
    logTime(log, start, `Finished Initiating uninstall`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, store, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    log.debug(`Response started for uninstall`);

    const { params, processID } = message;
    const {
      initiatorIdentifier,
      appIdentityHash,
      multisigAddress,
    } = params as ProtocolParams.Uninstall;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: appToUninstall.toJson(),
        role: ProtocolRoles.responder,
        stateChannel: preProtocolStateChannel.toJson(),
      } as UninstallMiddlewareContext,
    ];

    // 40ms
    const postProtocolStateChannel = await computeStateTransition(
      params as ProtocolParams.Uninstall,
      network.provider,
      preProtocolStateChannel,
      appToUninstall,
      log,
    );

    // 0ms
    const initiatorFreeBalanceKey = getSignerAddressFromPublicIdentifier(initiatorIdentifier);

    const uninstallCommitment = getSetStateCommitment(
      context,
      postProtocolStateChannel.freeBalance,
    );

    const counterpartySignature = context.message.customData.signature;
    const uninstallCommitmentHash = uninstallCommitment.hashToSign();

    let checkpoint = Date.now();
    // 15ms
    await assertIsValidSignature(
      initiatorFreeBalanceKey,
      uninstallCommitmentHash,
      counterpartySignature,
    );
    logTime(log, checkpoint, `Asserted valid signature in responding uninstall`);
    checkpoint = Date.now();

    // 10ms
    const mySignature = yield [OP_SIGN, uninstallCommitmentHash];
    logTime(log, checkpoint, `Signed commitment in responding uninstall`);

    const isInitiator = postProtocolStateChannel
      .multisigOwners[0] !== initiatorFreeBalanceKey;
    // use channel initiator bc free balance app
    await uninstallCommitment.addSignatures(
      isInitiator 
        ? mySignature
        : counterpartySignature as any,
      isInitiator
        ? counterpartySignature
        : mySignature as any,
    );

    yield [
      PERSIST_COMMITMENT,
      PersistCommitmentType.UpdateSetState,
      uninstallCommitment,
      postProtocolStateChannel.freeBalance.identityHash,
    ];

    // 59ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.RemoveInstance,
      postProtocolStateChannel,
      appToUninstall,
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

    // 100ms
    logTime(log, start, `Finished responding to uninstall`);
  },
};

async function computeStateTransition(
  params: ProtocolParams.Uninstall,
  provider: JsonRpcProvider,
  stateChannel: StateChannel,
  appInstance: AppInstance,
  log?: ILoggerService,
) {
  const { blockNumberToUseIfNecessary } = params;
  return stateChannel.uninstallApp(
    appInstance,
    await computeTokenIndexedFreeBalanceIncrements(
      appInstance,
      provider,
      undefined,
      blockNumberToUseIfNecessary,
      log,
    ),
  );
}
