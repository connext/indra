import { ProtocolNames, ProtocolParams, IStoreService } from "@connext/types";
import { JsonRpcProvider } from "ethers/providers";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import {
  Context,
  Opcode,
  ProtocolExecutionFlow,
  ProtocolMessage,
  PersistAppType,
  PersistCommitmentType,
} from "../types";
import { logTime } from "../utils";
import { xkeyKthAddress } from "../xkeys";

import { assertIsValidSignature, computeTokenIndexedFreeBalanceIncrements, stateChannelClassFromStoreByMultisig } from "./utils";

const protocol = ProtocolNames.uninstall;
const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE, PERSIST_COMMITMENT } = Opcode;

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
    let substart;
    log.debug(`Initiation started`);

    const { params, processID } = message;
    const { responderXpub, appIdentityHash, multisigAddress } = params as ProtocolParams.Uninstall;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(multisigAddress, store);
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    const postProtocolStateChannel = await computeStateTransition(
      params as ProtocolParams.Uninstall,
      store,
      network.provider,
    );

    const responderEphemeralKey = xkeyKthAddress(responderXpub, appToUninstall.appSeqNo);

    const uninstallCommitment = getSetStateCommitment(
      context,
      postProtocolStateChannel.freeBalance,
    );

    const signature = yield [OP_SIGN, uninstallCommitment, appToUninstall.appSeqNo];

    substart = Date.now();
    const {
      customData: { signature: responderSignature },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        protocol,
        processID,
        params,
        toXpub: responderXpub,
        customData: { signature },
        seq: 1,
      } as ProtocolMessage,
    ];
    logTime(log, substart, `Received responder's sig`);

    substart = Date.now();
    await assertIsValidSignature(responderEphemeralKey, uninstallCommitment, responderSignature);
    logTime(log, substart, `Verified responder's sig`);

    uninstallCommitment.signatures = [signature, responderSignature];

    yield [PERSIST_COMMITMENT, PersistCommitmentType.UpdateSetState, uninstallCommitment, postProtocolStateChannel.freeBalance.identityHash];

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.RemoveInstance,
      postProtocolStateChannel,
      appToUninstall,
    ];

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.UpdateFreeBalance,
      postProtocolStateChannel,
      postProtocolStateChannel.freeBalance,
    ];

    logTime(log, start, `Finished Initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, store, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Response started`);

    const { params, processID } = message;
    const { initiatorXpub, appIdentityHash, multisigAddress } = params as ProtocolParams.Uninstall;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(multisigAddress, store);
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    const postProtocolStateChannel = await computeStateTransition(
      params as ProtocolParams.Uninstall,
      store,
      network.provider,
    );

    const initiatorEphemeralKey = xkeyKthAddress(initiatorXpub, appToUninstall.appSeqNo);

    const uninstallCommitment = getSetStateCommitment(
      context,
      postProtocolStateChannel.freeBalance,
    );

    const initiatorSignature = context.message.customData.signature;

    substart = Date.now();
    await assertIsValidSignature(initiatorEphemeralKey, uninstallCommitment, initiatorSignature);
    logTime(log, substart, `Verified initiator's sig`);

    const responderSignature = yield [OP_SIGN, uninstallCommitment, appToUninstall.appSeqNo];

    uninstallCommitment.signatures = [responderSignature, initiatorSignature];

    yield [PERSIST_COMMITMENT, PersistCommitmentType.UpdateSetState, uninstallCommitment, postProtocolStateChannel.freeBalance.identityHash];

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.RemoveInstance,
      postProtocolStateChannel,
      appToUninstall,
    ];

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.UpdateFreeBalance,
      postProtocolStateChannel,
      postProtocolStateChannel.freeBalance,
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
      } as ProtocolMessage,
    ];
    logTime(log, start, `Finished responding`);
  },
};

async function computeStateTransition(
  params: ProtocolParams.Uninstall,
  store: IStoreService,
  provider: JsonRpcProvider,
) {
  const { appIdentityHash, multisigAddress, blockNumberToUseIfNecessary } = params;
  const stateChannel = await stateChannelClassFromStoreByMultisig(multisigAddress, store);
  return stateChannel.uninstallApp(
    appIdentityHash,
    await computeTokenIndexedFreeBalanceIncrements(
      stateChannel.getAppInstance(appIdentityHash),
      provider,
      undefined,
      blockNumberToUseIfNecessary,
    ),
  );
}
