import {
  InstallMiddlewareContext,
  Opcode,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
} from "@connext/types";
import {
  getAddressFromAssetId,
  getSignerAddressFromPublicIdentifier,
  logTime,
  stringify,
} from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { AppInstance, StateChannel, TokenIndexedCoinTransferMap } from "../models";
import { Context, PersistAppType, ProtocolExecutionFlow } from "../types";
import { assertSufficientFundsWithinFreeBalance } from "../utils";

import { assertIsValidSignature } from "./utils";

const protocol = ProtocolNames.install;
const { OP_SIGN, OP_VALIDATE, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE } = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/05-install-protocol#messages
 */
export const INSTALL_PROTOCOL: ProtocolExecutionFlow = {
  /**
   * Sequence 0 of the INSTALL_PROTOCOL requires the initiator party
   * to sign the ConditionalTransactionCommitment for the as-yet un-funded
   * newly proposed AppInstance, wait for a countersignature, and then when
   * received countersign the _also received_ free balance state update to
   * activate / fund the new app, and send the signature to that back to the
   * counterparty to finish the protocol.
   *
   * @param {Context} context
   */

  0 /* Initiating */: async function* (context: Context) {
    const {
      preProtocolStateChannel,
      message: { params, processID },
    } = context;
    const log = context.log.newContext("CF-InstallProtocol");
    const start = Date.now();
    let substart = start;
    log.info(`[${processID}] Initiation started`);
    log.debug(`[${processID}] Protocol initiated with parameters ${stringify(params)}`);

    if (!preProtocolStateChannel) throw new Error("No state channel found for install");

    const {
      initiatorBalanceDecrement,
      initiatorDepositAssetId,
      initiatorIdentifier,
      responderBalanceDecrement,
      responderDepositAssetId,
      responderIdentifier,
    } = params as ProtocolParams.Install;

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      initiatorIdentifier,
      getAddressFromAssetId(initiatorDepositAssetId),
      initiatorBalanceDecrement,
    );

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      responderIdentifier,
      getAddressFromAssetId(responderDepositAssetId),
      responderBalanceDecrement,
    );

    const stateChannelAfter = computeInstallStateChannelTransition(
      preProtocolStateChannel,
      params as ProtocolParams.Install,
    );

    const newAppInstance = stateChannelAfter.getAppInstanceByAppSeqNo(
      (params as ProtocolParams.Install).appSeqNo,
    );

    // safe to do here, nothing is signed or written to store
    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        stateChannel: preProtocolStateChannel.toJson(),
        appInstance: newAppInstance.toJson(),
        role: ProtocolRoles.initiator,
      } as InstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${processID}] Validated app ${newAppInstance.identityHash}`);
    substart = Date.now();

    const freeBalanceUpdateData = getSetStateCommitment(context, stateChannelAfter.freeBalance);
    const freeBalanceUpdateDataHash = freeBalanceUpdateData.hashToSign();

    // 12ms
    // always use free balance key to sign free balance update
    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateDataHash];

    // 124ms
    const {
      data: {
        customData: { signature: counterpartySignatureOnFreeBalanceStateUpdate },
      },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        params,
        protocol,
        to: responderIdentifier,
        customData: {
          signature: mySignatureOnFreeBalanceStateUpdate,
        },
        seq: 1,
      } as ProtocolMessageData,
    ] as any;

    // 7ms
    // free balance addr signs conditional transactions
    substart = Date.now();

    // 0ms
    const responderSignerAddress = getSignerAddressFromPublicIdentifier(responderIdentifier);

    const isChannelInitiator = stateChannelAfter.multisigOwners[0] !== responderSignerAddress;

    // 7ms
    // always use free balance key to sign free balance update
    await assertIsValidSignature(
      responderSignerAddress,
      freeBalanceUpdateDataHash,
      counterpartySignatureOnFreeBalanceStateUpdate,
      `Failed to validate responders signature on free balance update in the install protocol. Our commitment: ${stringify(
        freeBalanceUpdateData.toJson(),
      )}`,
    );
    logTime(log, substart, `[${processID}] Verified responder's sig on free balance update`);
    substart = Date.now();

    // add signatures to commitment
    await freeBalanceUpdateData.addSignatures(
      isChannelInitiator
        ? (mySignatureOnFreeBalanceStateUpdate as any)
        : counterpartySignatureOnFreeBalanceStateUpdate,
      isChannelInitiator
        ? counterpartySignatureOnFreeBalanceStateUpdate
        : (mySignatureOnFreeBalanceStateUpdate as any),
    );

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateInstance,
      stateChannelAfter,
      newAppInstance,
      freeBalanceUpdateData,
    ];

    // 335ms
    logTime(log, start, `[${processID}] Initiation finished`);
  } as any,

  /**
   * Sequence 1 of the INSTALL_PROTOCOL requires the responder party
   * to countersignsign the ConditionalTransactionCommitment and then sign
   * the update to the free balance object, wait for the intitiating party to
   * sign _that_ and then finish the protocol.
   *
   * @param {Context} context
   */

  1 /* Responding */: async function* (context: Context) {
    const {
      message: {
        params,
        processID,
        customData: { signature },
      },
      preProtocolStateChannel,
    } = context;
    const log = context.log.newContext("CF-InstallProtocol");
    const start = Date.now();
    let substart = start;
    log.info(`[${processID}] Response started`);
    log.debug(`[${processID}] Protocol response started with parameters ${stringify(params)}`);

    // Aliasing `signature` to this variable name for code clarity
    const counterpartySignatureOnFreeBalanceStateUpdate = signature;

    const {
      initiatorBalanceDecrement,
      initiatorDepositAssetId,
      initiatorIdentifier,
      responderBalanceDecrement,
      responderDepositAssetId,
      responderIdentifier,
    } = params as ProtocolParams.Install;

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for install");
    }

    // 1ms
    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      initiatorIdentifier,
      getAddressFromAssetId(initiatorDepositAssetId),
      initiatorBalanceDecrement,
    );

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      responderIdentifier,
      getAddressFromAssetId(responderDepositAssetId),
      responderBalanceDecrement,
    );

    const stateChannelAfter = computeInstallStateChannelTransition(
      preProtocolStateChannel,
      params as ProtocolParams.Install,
    );

    // 0ms
    const initiatorSignerAddress = getSignerAddressFromPublicIdentifier(initiatorIdentifier);

    const newAppInstance = stateChannelAfter.getAppInstanceByAppSeqNo(
      (params as ProtocolParams.Install).appSeqNo,
    );

    // safe to do here, nothing is signed or written to store
    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        stateChannel: preProtocolStateChannel.toJson(),
        appInstance: newAppInstance.toJson(),
        role: ProtocolRoles.responder,
      } as InstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${processID}] Validated app ${newAppInstance.identityHash}`);
    substart = Date.now();

    // 7ms
    // multisig owner always signs conditional tx
    const freeBalanceUpdateData = getSetStateCommitment(context, stateChannelAfter.freeBalance);
    const freeBalanceUpdateDataHash = freeBalanceUpdateData.hashToSign();
    await assertIsValidSignature(
      initiatorSignerAddress,
      freeBalanceUpdateDataHash,
      counterpartySignatureOnFreeBalanceStateUpdate,
      `Failed to validate initiators signature on conditional transaction commitment in the install protocol. Our commitment: ${stringify(
        freeBalanceUpdateData.toJson(),
      )}`,
    );
    logTime(log, substart, `[${processID}] Verified initiator's free balance update sig`);
    substart = Date.now();

    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateDataHash];

    // add signature
    const isChannelInitiator = stateChannelAfter.multisigOwners[0] !== initiatorSignerAddress;
    await freeBalanceUpdateData.addSignatures(
      isChannelInitiator
        ? (mySignatureOnFreeBalanceStateUpdate as any)
        : counterpartySignatureOnFreeBalanceStateUpdate,
      isChannelInitiator
        ? counterpartySignatureOnFreeBalanceStateUpdate
        : (mySignatureOnFreeBalanceStateUpdate as any),
    );

    // 13ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateInstance,
      stateChannelAfter,
      newAppInstance,
      freeBalanceUpdateData,
    ];
    logTime(log, substart, `[${processID}] Persisted app ${newAppInstance.identityHash}`);
    substart = Date.now();

    // 154ms
    yield [
      IO_SEND,
      {
        processID,
        protocol,
        to: initiatorIdentifier,
        customData: {
          signature: mySignatureOnFreeBalanceStateUpdate,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessageData,
      stateChannelAfter,
    ] as any;

    // 272ms
    logTime(log, start, `[${processID}] Response finished`);
  } as any,
};

/**
 * Generates the would-be new StateChannel to represent the final state of the
 * StateChannel after the protocol would be executed with correct signatures.
 *
 * @param {StateChannel} stateChannel - The pre-protocol state of the channel
 * @param {ProtocolParams.Install} params - Parameters about the new AppInstance
 *
 * @returns {Promise<StateChannel>} - The post-protocol state of the channel
 */
function computeInstallStateChannelTransition(
  stateChannel: StateChannel,
  params: ProtocolParams.Install,
): StateChannel {
  const {
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    initiatorDepositAssetId,
    responderDepositAssetId,
    appInitiatorIdentifier,
    initiatorIdentifier,
  } = params;

  // initiator in params context corr to protocol initiator
  // retrieve app-specific values for interpreter params, etc.
  const appInitiatorFbAddress = stateChannel.getFreeBalanceAddrOf(appInitiatorIdentifier);
  const isSame = appInitiatorIdentifier === initiatorIdentifier;
  const appInitiatorAssetId = isSame ? initiatorDepositAssetId : responderDepositAssetId;
  const appResponderAssetId = isSame ? responderDepositAssetId : initiatorDepositAssetId;
  const appInitiatorBalanceDecrement = isSame
    ? initiatorBalanceDecrement
    : responderBalanceDecrement;
  const appResponderBalanceDecrement = isSame
    ? responderBalanceDecrement
    : initiatorBalanceDecrement;

  // make sure the addresses mirror the free balance addresses of
  // the channel
  const channelInitiatorFbAddress = stateChannel.multisigOwners[0];
  const channelResponderFbAddress = stateChannel.multisigOwners[1];
  const sameChannelAndAppOrdering = channelInitiatorFbAddress === appInitiatorFbAddress;

  const proposal = stateChannel.proposedAppInstances.get(params.identityHash);
  if (!proposal) {
    throw new Error("There should be a proposal here, we got it before. Wtf?");
  }

  const appInstanceToBeInstalled = AppInstance.fromJson(proposal);

  // does not matter for asset ids
  const initiatorDepositTokenAddress = getAddressFromAssetId(appInitiatorAssetId);
  const responderDepositTokenAddress = getAddressFromAssetId(appResponderAssetId);

  let tokenIndexedBalanceDecrement: TokenIndexedCoinTransferMap;
  if (initiatorDepositTokenAddress !== responderDepositTokenAddress) {
    const keys = [
      sameChannelAndAppOrdering ? initiatorDepositTokenAddress : responderDepositTokenAddress,
      sameChannelAndAppOrdering ? responderDepositTokenAddress : initiatorDepositTokenAddress,
    ];
    tokenIndexedBalanceDecrement = {
      [keys[0]]: {
        [channelInitiatorFbAddress]: sameChannelAndAppOrdering
          ? appInitiatorBalanceDecrement
          : appResponderBalanceDecrement,
      },
      [keys[1]]: {
        [channelResponderFbAddress]: sameChannelAndAppOrdering
          ? appResponderBalanceDecrement
          : appInitiatorBalanceDecrement,
      },
    };
  } else {
    // If the decrements are on the same token, the previous block
    // sets the decrement only on the `respondingFbAddress` and the
    // `initiatingFbAddress` would get overwritten
    tokenIndexedBalanceDecrement = {
      [initiatorDepositTokenAddress]: {
        [channelInitiatorFbAddress]: sameChannelAndAppOrdering
          ? appInitiatorBalanceDecrement
          : appResponderBalanceDecrement,
        [channelResponderFbAddress]: sameChannelAndAppOrdering
          ? appResponderBalanceDecrement
          : appInitiatorBalanceDecrement,
      },
    };
  }

  return stateChannel.installApp(appInstanceToBeInstalled, tokenIndexedBalanceDecrement);
}
