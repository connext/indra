import {
  ILoggerService,
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  UninstallMiddlewareContext,
} from "@connext/types";
import { providers } from "ethers";
import { getSignerAddressFromPublicIdentifier, logTime, stringify } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { AppInstance, StateChannel } from "../models";
import { Context, PersistAppType, ProtocolExecutionFlow } from "../types";

import { assertIsValidSignature, computeTokenIndexedFreeBalanceIncrements } from "./utils";

const protocol = ProtocolNames.uninstall;
const { OP_SIGN, OP_VALIDATE, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE } = Opcode;
/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/06-uninstall-protocol#messages
 */
export const UNINSTALL_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const { message, network, preProtocolStateChannel } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart = start;
    const { params, processID } = message;
    log.info(`[${processID}] Initiation started`);
    log.debug(`[${processID}] Protocol initiated with params ${stringify(params)}`);

    const {
      responderIdentifier,
      appIdentityHash,
      action,
      stateTimeout,
    } = params as ProtocolParams.Uninstall;

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for uninstall");
    }
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

    let preUninstallStateChannel: StateChannel;
    if (action) {
      log.info(`Action provided. Finalizing app before uninstall`);
      // apply action
      substart = Date.now();
      const newState = await appToUninstall.computeStateTransition(action, network.provider);
      logTime(log, substart, `[${processID}] computeStateTransition for action complete`);
      // ensure state is finalized after applying action
      if (!(newState as any).finalized) {
        throw new Error(`Action provided did not lead to terminal state, refusing to uninstall.`);
      }
      log.debug(`Resulting state is terminal state, proceeding with uninstall`);
      substart = Date.now();
      preUninstallStateChannel = preProtocolStateChannel.setState(
        appToUninstall,
        newState,
        stateTimeout,
      );
      logTime(log, substart, `[${processID}] setState for action complete`);
    } else {
      preUninstallStateChannel = preProtocolStateChannel;
    }
    // make sure the uninstalled app is the finalized app
    const preUninstallApp = preUninstallStateChannel.appInstances.get(appToUninstall.identityHash)!;

    substart = Date.now();
    const postProtocolStateChannel = await computeStateTransition(
      params as ProtocolParams.Uninstall,
      network.provider,
      preUninstallStateChannel,
      preUninstallApp,
      log,
    );
    logTime(log, substart, `[${processID}] computeStateTransition for uninstall complete`);

    substart = Date.now();
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
      preUninstallApp,
      uninstallCommitment,
    ];

    // 204ms
    logTime(log, start, `[${processID}] Initiation finished`);
  } as any,

  1 /* Responding */: async function* (context: Context) {
    const { message, preProtocolStateChannel, network } = context;
    const log = context.log.newContext("CF-UninstallProtocol");
    const start = Date.now();
    let substart = start;
    const { params, processID } = message;
    log.info(`[${processID}] Response started`);
    log.debug(`[${processID}] Protocol response started with params ${stringify(params)}`);

    const {
      initiatorIdentifier,
      appIdentityHash,
      action,
      stateTimeout,
    } = params as ProtocolParams.Uninstall;

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for proposal");
    }
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

    let preUninstallStateChannel: StateChannel;
    if (action) {
      log.info(`Action provided. Finalizing app before uninstall`);
      // apply action
      substart = Date.now();
      const newState = await appToUninstall.computeStateTransition(action, network.provider);
      logTime(log, substart, `[${processID}] computeStateTransition for action complete`);
      // ensure state is finalized after applying action
      if (!(newState as any).finalized) {
        throw new Error(`Action provided did not lead to terminal state, refusing to uninstall.`);
      }
      log.debug(`Resulting state is terminal state, proceeding with uninstall`);
      substart = Date.now();
      preUninstallStateChannel = preProtocolStateChannel.setState(
        appToUninstall,
        newState,
        stateTimeout,
      );
      logTime(log, substart, `[${processID}] setState for action complete`);
    } else {
      preUninstallStateChannel = preProtocolStateChannel;
    }
    // make sure the uninstalled app is the finalized app
    const preUninstallApp = preUninstallStateChannel.appInstances.get(appToUninstall.identityHash)!;

    substart = Date.now();
    const postProtocolStateChannel = await computeStateTransition(
      params as ProtocolParams.Uninstall,
      network.provider,
      preUninstallStateChannel,
      preUninstallApp,
      log,
    );
    logTime(log, substart, `[${processID}] computeStateTransition for uninstall complete`);

    substart = Date.now();
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
      preUninstallApp,
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
      preUninstallApp,
    ];

    // 100ms
    logTime(log, start, `[${processID}] Response finished`);
  },
};

async function computeStateTransition(
  params: ProtocolParams.Uninstall,
  provider: providers.JsonRpcProvider,
  stateChannel: StateChannel,
  appInstance: AppInstance,
  log?: ILoggerService,
) {
  return stateChannel.uninstallApp(
    appInstance,
    await computeTokenIndexedFreeBalanceIncrements(appInstance, provider, undefined, log),
  );
}
