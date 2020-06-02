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
import { getSignerAddressFromPublicIdentifier, logTime, stringify } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { AppInstance, StateChannel } from "../models";
import { Context, PersistAppType, ProtocolExecutionFlow } from "../types";

import {
  assertIsValidSignature,
  computeTokenIndexedFreeBalanceIncrements,
  stateChannelClassFromStoreByMultisig,
} from "./utils";

const protocol = ProtocolNames.uninstall;
const { OP_SIGN, OP_VALIDATE, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE } = Opcode;
/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/06-uninstall-protocol#messages
 */
export const UNINSTALL_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const { message, store, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart = start;
    const { params, processID } = message;
    log.info(`[${processID}] Initiation started`);
    log.debug(`[${processID}] Protocol initiated with params ${stringify(params)}`);

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

    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: appToUninstall.toJson(),
        role: ProtocolRoles.initiator,
        stateChannel: preProtocolStateChannel.toJson(),
      } as UninstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${processID}] Validated uninstall request`);
    substart = Date.now();

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

    // 4ms
    const mySignature = yield [OP_SIGN, uninstallCommitmentHash];
    logTime(log, substart, `[${processID}] Signed uninstall commitment initiator`);
    substart = Date.now();

    // 94ms
    const {
      data: {
        customData: { signature: counterpartySignature },
      },
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
    ] as any;

    // 6ms
    await assertIsValidSignature(
      responderFreeBalanceKey,
      uninstallCommitmentHash,
      counterpartySignature,
      `Failed to validate responder's signature on free balance commitment in the uninstall protocol. Our commitment: ${stringify(
        uninstallCommitment.toJson(),
      )}`,
    );
    logTime(log, substart, `[${processID}] Verified responder's sig`);

    const isInitiator = postProtocolStateChannel.multisigOwners[0] !== responderFreeBalanceKey;
    // use channel initiator bc free balance app
    await uninstallCommitment.addSignatures(
      isInitiator ? (mySignature as any) : counterpartySignature,
      isInitiator ? counterpartySignature : (mySignature as any),
    );

    // 24ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.RemoveInstance,
      postProtocolStateChannel,
      appToUninstall,
      uninstallCommitment,
    ];

    // 204ms
    logTime(log, start, `[${processID}] Initiation finished`);
  } as any,

  1 /* Responding */: async function* (context: Context) {
    const { message, store, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart = start;
    const { params, processID } = message;
    log.info(`[${processID}] Response started`);
    log.debug(`[${processID}] Protocol response started with params ${stringify(params)}`);

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

    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        appInstance: appToUninstall.toJson(),
        role: ProtocolRoles.responder,
        stateChannel: preProtocolStateChannel.toJson(),
      } as UninstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${processID}] Validated uninstall request`);
    substart = Date.now();

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

    // 15ms
    await assertIsValidSignature(
      initiatorFreeBalanceKey,
      uninstallCommitmentHash,
      counterpartySignature,
      `Failed to validate initiator's signature on free balance commitment in the uninstall protocol. Our commitment: ${stringify(
        uninstallCommitment.toJson(),
      )}`,
    );
    logTime(log, substart, `[${processID}] Asserted valid signature in responding uninstall`);
    substart = Date.now();

    // 10ms
    const mySignature = yield [OP_SIGN, uninstallCommitmentHash];
    logTime(log, substart, `[${processID}] Signed commitment in responding uninstall`);

    const isInitiator = postProtocolStateChannel.multisigOwners[0] !== initiatorFreeBalanceKey;
    // use channel initiator bc free balance app
    await uninstallCommitment.addSignatures(
      isInitiator ? mySignature : (counterpartySignature as any),
      isInitiator ? counterpartySignature : (mySignature as any),
    );

    // 59ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.RemoveInstance,
      postProtocolStateChannel,
      appToUninstall,
      uninstallCommitment,
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
      postProtocolStateChannel,
    ];

    // 100ms
    logTime(log, start, `[${processID}] Response finished`);
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
