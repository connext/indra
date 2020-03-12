import { BaseProvider } from "ethers/providers";

import { SetStateCommitment } from "../ethereum";
import { Opcode, Protocol, xkeyKthAddress, Commitment } from "../machine";
import { StateChannel } from "../models";
import { Context, ProtocolExecutionFlow, ProtocolMessage, UninstallProtocolParams } from "../types";
import { logTime } from "../utils";

import { Store } from "../store";
import {
  assertIsValidSignature,
  computeTokenIndexedFreeBalanceIncrements,
  UNASSIGNED_SEQ_NO,
} from "./utils";

const protocol = Protocol.Uninstall;
const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL, PERSIST_COMMITMENT } = Opcode;
const { SetState } = Commitment;

/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/06-uninstall-protocol#messages
 */
export const UNINSTALL_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    const { message, provider, store, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Initiation started`);

    const { params, processID } = message;
    const { responderXpub, appIdentityHash, multisigAddress } = params as UninstallProtocolParams;

    const preProtocolStateChannel = await store.getStateChannel(multisigAddress);
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    const postProtocolStateChannel = await computeStateTransition(
      params as UninstallProtocolParams,
      store,
      provider,
    );

    const responderEphemeralKey = xkeyKthAddress(responderXpub, appToUninstall.appSeqNo);

    const uninstallCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      postProtocolStateChannel.freeBalance.identity,
      postProtocolStateChannel.freeBalance.hashOfLatestState,
      postProtocolStateChannel.freeBalance.versionNumber,
      postProtocolStateChannel.freeBalance.timeout,
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
    assertIsValidSignature(responderEphemeralKey, uninstallCommitment, responderSignature);
    logTime(log, substart, `Verified responder's sig`);

    uninstallCommitment.signatures = [signature, responderSignature];

    yield [PERSIST_COMMITMENT, SetState, uninstallCommitment, appIdentityHash];

    yield [PERSIST_STATE_CHANNEL, [postProtocolStateChannel]];

    logTime(log, start, `Finished Initiating`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, provider, store, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Response started`);

    const { params, processID } = message;
    const { initiatorXpub, appIdentityHash, multisigAddress } = params as UninstallProtocolParams;

    const preProtocolStateChannel = (await store.getStateChannel(multisigAddress)) as StateChannel;
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    const postProtocolStateChannel = await computeStateTransition(
      params as UninstallProtocolParams,
      store,
      provider,
    );

    const initiatorEphemeralKey = xkeyKthAddress(initiatorXpub, appToUninstall.appSeqNo);

    const uninstallCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      postProtocolStateChannel.freeBalance.identity,
      postProtocolStateChannel.freeBalance.hashOfLatestState,
      postProtocolStateChannel.freeBalance.versionNumber,
      postProtocolStateChannel.freeBalance.timeout,
    );

    const initiatorSignature = context.message.customData.signature;

    substart = Date.now();
    assertIsValidSignature(initiatorEphemeralKey, uninstallCommitment, initiatorSignature);
    logTime(log, substart, `Verified initiator's sig`);

    const responderSignature = yield [OP_SIGN, uninstallCommitment, appToUninstall.appSeqNo];

    uninstallCommitment.signatures = [responderSignature, initiatorSignature];

    yield [PERSIST_COMMITMENT, SetState, uninstallCommitment, appIdentityHash];

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
    logTime(log, start, `Finished responding`);
  },
};

async function computeStateTransition(
  params: UninstallProtocolParams,
  store: Store,
  provider: BaseProvider,
) {
  const { appIdentityHash, multisigAddress, blockNumberToUseIfNecessary } = params;
  const stateChannel = await store.getStateChannel(multisigAddress);
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
