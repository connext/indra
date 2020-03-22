import { PersistAppType, ILoggerService } from "@connext/types";
import { BaseProvider } from "ethers/providers";

import { SetStateCommitment } from "../ethereum";
import { Opcode, Protocol, xkeyKthAddress, Commitment } from "../machine";
import { StateChannel, AppInstance } from "../models";
import { Context, ProtocolExecutionFlow, ProtocolMessage, UninstallProtocolParams } from "../types";
import { logTime } from "../utils";

import { Store } from "../store";
import {
  assertIsValidSignature,
  computeTokenIndexedFreeBalanceIncrements,
  UNASSIGNED_SEQ_NO,
} from "./utils";

const protocol = Protocol.Uninstall;
const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE, PERSIST_COMMITMENT } = Opcode;
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
    log.debug(`Initiation started for uninstall`);

    const { params, processID } = message;
    const { responderXpub, appIdentityHash, multisigAddress } = params as UninstallProtocolParams;

    // 6ms
    const preProtocolStateChannel = await store.getStateChannel(multisigAddress);

    // 1ms
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    // 47ms
    const postProtocolStateChannel = await computeStateTransition(
      params as UninstallProtocolParams,
      provider,
      preProtocolStateChannel,
      appToUninstall,
      log,
    );

    // 0ms
    const responderEphemeralKey = xkeyKthAddress(responderXpub, appToUninstall.appSeqNo);

    const uninstallCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      postProtocolStateChannel.freeBalance.identity,
      postProtocolStateChannel.freeBalance.hashOfLatestState,
      postProtocolStateChannel.freeBalance.versionNumber,
      postProtocolStateChannel.freeBalance.timeout,
    );
    const uninstallCommitmentHash = uninstallCommitment.hashToSign();

    let checkpoint = Date.now(); 
    // 4ms
    const signature = yield [OP_SIGN, uninstallCommitmentHash, appToUninstall.appSeqNo];
    logTime(log, checkpoint, `Signed uninstall commitment initiator`)

    // 94ms
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
  
    checkpoint = Date.now(); 
    // 6ms
    await assertIsValidSignature(responderEphemeralKey, uninstallCommitmentHash, responderSignature);
    logTime(log, checkpoint, `Asserted valid signature in initiating uninstall`)

    uninstallCommitment.signatures = [signature, responderSignature];

    // 5ms
    yield [PERSIST_COMMITMENT, SetState, uninstallCommitment, appIdentityHash];

    // 24ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.Uninstall,
      postProtocolStateChannel,
      appToUninstall,
    ];

    // 204ms
    logTime(log, start, `Finished Initiating uninstall`);
  },

  1 /* Responding */: async function*(context: Context) {
    const { message, provider, store, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    log.debug(`Response started for uninstall`);

    const { params, processID } = message;
    const { initiatorXpub, appIdentityHash, multisigAddress } = params as UninstallProtocolParams;

    // 9ms
    const preProtocolStateChannel = (await store.getStateChannel(multisigAddress)) as StateChannel;

    // 0ms
    const appToUninstall = preProtocolStateChannel.getAppInstance(appIdentityHash);

    // 40ms
    const postProtocolStateChannel = await computeStateTransition(
      params as UninstallProtocolParams,
      provider,
      preProtocolStateChannel,
      appToUninstall,
      log,
    );

    // 0ms
    const initiatorEphemeralKey = xkeyKthAddress(initiatorXpub, appToUninstall.appSeqNo);

    const uninstallCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      postProtocolStateChannel.freeBalance.identity,
      postProtocolStateChannel.freeBalance.hashOfLatestState,
      postProtocolStateChannel.freeBalance.versionNumber,
      postProtocolStateChannel.freeBalance.timeout,
    );

    const initiatorSignature = context.message.customData.signature;
    const uninstallCommitmentHash = uninstallCommitment.hashToSign();

    let checkpoint = Date.now();
    // 15ms
    await assertIsValidSignature(initiatorEphemeralKey, uninstallCommitmentHash, initiatorSignature);
    logTime(log, checkpoint, `Asserted valid signature in responding uninstall`)
    checkpoint = Date.now();

    // 10ms
    const responderSignature = yield [OP_SIGN, uninstallCommitmentHash, appToUninstall.appSeqNo];
    logTime(log, checkpoint, `Signed commitment in responding uninstall`)

    uninstallCommitment.signatures = [responderSignature, initiatorSignature];

    // 13ms
    yield [PERSIST_COMMITMENT, SetState, uninstallCommitment, appIdentityHash];

    // 59ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.Uninstall,
      postProtocolStateChannel,
      appToUninstall,
    ];

    // 0ms
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

    // 100ms
    logTime(log, start, `Finished responding to uninstall`);
  },
};

async function computeStateTransition(
  params: UninstallProtocolParams,
  provider: BaseProvider,
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
      log
    ),
  );
}
