import {
  InstallMiddlewareContext,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  Opcode,
  OutcomeType,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
  AssetId,
} from "@connext/types";
import {
  getAddressFromAssetId,
  getSignerAddressFromPublicIdentifier,
  logTime,
  stringify,
} from "@connext/utils";
import { constants, utils } from "ethers";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { TWO_PARTY_OUTCOME_DIFFERENT_ASSETS } from "../errors";
import { getConditionalTransactionCommitment, getSetStateCommitment } from "../ethereum";
import { AppInstance, StateChannel, TokenIndexedCoinTransferMap } from "../models";
import { Context, PersistAppType, ProtocolExecutionFlow } from "../types";
import { assertSufficientFundsWithinFreeBalance } from "../utils";

import { assertIsValidSignature, stateChannelClassFromStoreByMultisig } from "./utils";

const { MaxUint256 } = constants;

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
      store,
      message: { params, processID },
    } = context;
    const log = context.log.newContext("CF-InstallProtocol");
    const start = Date.now();
    let substart = start;
    log.info(`[${processID}] Initiation started`);
    log.debug(`[${processID}] Protocol initiated with parameters ${stringify(params)}`);

    const {
      initiatorBalanceDecrement,
      initiatorDepositAssetId,
      initiatorIdentifier,
      multisigAddress,
      responderBalanceDecrement,
      responderDepositAssetId,
      responderIdentifier,
    } = params as ProtocolParams.Install;

    const stateChannelBefore = await stateChannelClassFromStoreByMultisig(multisigAddress, store);

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      stateChannelBefore,
      initiatorIdentifier,
      getAddressFromAssetId(initiatorDepositAssetId),
      initiatorBalanceDecrement,
    );

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      stateChannelBefore,
      responderIdentifier,
      getAddressFromAssetId(responderDepositAssetId),
      responderBalanceDecrement,
    );

    const stateChannelAfter = computeInstallStateChannelTransition(
      stateChannelBefore,
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
        stateChannel: stateChannelBefore.toJson(),
        appInstance: newAppInstance.toJson(),
        role: ProtocolRoles.initiator,
      } as InstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${processID}] Validated app ${newAppInstance.identityHash}`);
    substart = Date.now();

    const conditionalTxCommitment = getConditionalTransactionCommitment(
      context,
      stateChannelAfter,
      newAppInstance,
    );
    const conditionalTxCommitmentHash = conditionalTxCommitment.hashToSign();

    // 0ms
    const responderSignerAddress = getSignerAddressFromPublicIdentifier(responderIdentifier);

    // 6ms
    // free balance addr signs conditional transactions
    const mySignatureOnConditionalTransaction = yield [OP_SIGN, conditionalTxCommitmentHash];

    // 124ms
    const {
      data: {
        customData: {
          signature: counterpartySignatureOnConditionalTransaction,
          signature2: counterpartySignatureOnFreeBalanceStateUpdate,
        },
      },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        params,
        protocol,
        to: responderIdentifier,
        customData: {
          signature: mySignatureOnConditionalTransaction,
        },
        seq: 1,
      } as ProtocolMessageData,
    ] as any;

    // 7ms
    // free balance addr signs conditional transactions
    const { contractAddresses, ...toLog } = conditionalTxCommitment.toJson();
    await assertIsValidSignature(
      responderSignerAddress,
      conditionalTxCommitmentHash,
      counterpartySignatureOnConditionalTransaction,
      `Failed to validate responders signature on conditional transaction commitment in the install protocol. Our commitment: ${stringify(
        { ...toLog },
      )}`,
    );
    logTime(log, substart, `[${processID}] Verified responder's conditional sig`);
    substart = Date.now();

    const isChannelInitiator = stateChannelAfter.multisigOwners[0] !== responderSignerAddress;
    await conditionalTxCommitment.addSignatures(
      isChannelInitiator
        ? (mySignatureOnConditionalTransaction as any)
        : counterpartySignatureOnConditionalTransaction,
      isChannelInitiator
        ? counterpartySignatureOnConditionalTransaction
        : (mySignatureOnConditionalTransaction as any),
    );

    const freeBalanceUpdateData = getSetStateCommitment(context, stateChannelAfter.freeBalance);
    const freeBalanceUpdateDataHash = freeBalanceUpdateData.hashToSign();

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

    // 12ms
    // always use free balance key to sign free balance update
    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateDataHash];

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
      conditionalTxCommitment,
    ];

    // 51ms
    yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        protocol,
        to: responderIdentifier,
        customData: {
          signature: mySignatureOnFreeBalanceStateUpdate,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessageData,
      stateChannelAfter,
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
      store,
      message: {
        params,
        processID,
        customData: { signature },
      },
    } = context;
    const log = context.log.newContext("CF-InstallProtocol");
    const start = Date.now();
    let substart = start;
    log.info(`[${processID}] Response started`);
    log.debug(`[${processID}] Protocol response started with parameters ${stringify(params)}`);

    // Aliasing `signature` to this variable name for code clarity
    const counterpartySignatureOnConditionalTransaction = signature;

    const {
      initiatorBalanceDecrement,
      initiatorDepositAssetId,
      initiatorIdentifier,
      multisigAddress,
      responderBalanceDecrement,
      responderDepositAssetId,
      responderIdentifier,
    } = params as ProtocolParams.Install;

    const stateChannelBefore = await stateChannelClassFromStoreByMultisig(multisigAddress, store);

    // 1ms
    assertSufficientFundsWithinFreeBalance(
      stateChannelBefore,
      initiatorIdentifier,
      getAddressFromAssetId(initiatorDepositAssetId),
      initiatorBalanceDecrement,
    );

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      stateChannelBefore,
      responderIdentifier,
      getAddressFromAssetId(responderDepositAssetId),
      responderBalanceDecrement,
    );

    const stateChannelAfter = computeInstallStateChannelTransition(
      stateChannelBefore,
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
        stateChannel: stateChannelBefore.toJson(),
        appInstance: newAppInstance.toJson(),
        role: ProtocolRoles.responder,
      } as InstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${processID}] Validated app ${newAppInstance.identityHash}`);
    substart = Date.now();

    const conditionalTxCommitment = getConditionalTransactionCommitment(
      context,
      stateChannelAfter,
      newAppInstance,
    );
    const conditionalTxCommitmentHash = conditionalTxCommitment.hashToSign();

    // 7ms
    // multisig owner always signs conditional tx
    const { contractAddresses, ...toLog } = conditionalTxCommitment.toJson();
    await assertIsValidSignature(
      initiatorSignerAddress,
      conditionalTxCommitmentHash,
      counterpartySignatureOnConditionalTransaction,
      `Failed to validate initiators signature on conditional transaction commitment in the install protocol. Our commitment: ${stringify(
        toLog,
      )}`,
    );
    logTime(log, substart, `[${processID}] Verified initiator's conditional sig`);
    substart = Date.now();

    const mySignatureOnConditionalTransaction = yield [OP_SIGN, conditionalTxCommitmentHash];

    // add signatures to commitment
    const isChannelInitiator = stateChannelAfter.multisigOwners[0] !== initiatorSignerAddress;
    await conditionalTxCommitment.addSignatures(
      isChannelInitiator
        ? (mySignatureOnConditionalTransaction as any)
        : counterpartySignatureOnConditionalTransaction,
      isChannelInitiator
        ? counterpartySignatureOnConditionalTransaction
        : (mySignatureOnConditionalTransaction as any),
    );

    const freeBalanceUpdateData = getSetStateCommitment(context, stateChannelAfter.freeBalance);
    const freeBalanceUpdateDataHash = freeBalanceUpdateData.hashToSign();

    // 8ms
    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateDataHash];

    // 154ms
    const {
      data: {
        customData: { signature: counterpartySignatureOnFreeBalanceStateUpdate },
      },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        protocol,
        to: initiatorIdentifier,
        customData: {
          signature: mySignatureOnConditionalTransaction,
          signature2: mySignatureOnFreeBalanceStateUpdate,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessageData,
    ] as any;

    // 7ms
    // always use signerAddress to sign updates
    await assertIsValidSignature(
      initiatorSignerAddress,
      freeBalanceUpdateDataHash,
      counterpartySignatureOnFreeBalanceStateUpdate,
      `Failed to validate initiators signature on free balance update in the install protocol. Our commitment: ${stringify(
        freeBalanceUpdateData.toJson(),
      )}`,
    );
    logTime(log, substart, `[${processID}] Verified initiator's sig on free balance update`);
    substart = Date.now();

    // add signature
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
      conditionalTxCommitment,
    ];
    logTime(log, substart, `[${processID}] Persisted app ${newAppInstance.identityHash}`);
    substart = Date.now();

    const m4 = {
      processID,
      protocol,
      to: initiatorIdentifier,
      customData: {
        dataPersisted: true,
      },
      seq: UNASSIGNED_SEQ_NO,
    } as ProtocolMessageData;

    // 0ms
    yield [IO_SEND, m4, stateChannelAfter];

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
    initialState,
    appInterface,
    defaultTimeout,
    stateTimeout,
    appSeqNo,
    outcomeType,
    disableLimit,
    meta,
    appInitiatorIdentifier,
    appResponderIdentifier,
    initiatorIdentifier,
  } = params;

  // initiator in params context corr to protocol initiator
  // retrieve app-specific values for interpreter params, etc.
  const appInitiatorFbAddress = stateChannel.getFreeBalanceAddrOf(appInitiatorIdentifier);
  const appResponderFbAddress = stateChannel.getFreeBalanceAddrOf(appResponderIdentifier);
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

  const {
    multiAssetMultiPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
  } = computeInterpreterParameters(
    outcomeType,
    // make sure the asset id array is returned in same order
    // as channel since interpreter is multisig fn
    sameChannelAndAppOrdering ? appInitiatorAssetId : appResponderAssetId,
    sameChannelAndAppOrdering ? appResponderAssetId : appInitiatorAssetId,
    appInitiatorBalanceDecrement,
    appResponderBalanceDecrement,
    appInitiatorFbAddress,
    appResponderFbAddress,
    disableLimit,
  );

  const appInstanceToBeInstalled = new AppInstance(
    /* initiator */ appInitiatorIdentifier,
    /* responder */ appResponderIdentifier,
    /* defaultTimeout */ defaultTimeout.toHexString(),
    /* appInterface */ appInterface,
    /* appSeqNo */ appSeqNo,
    /* latestState */ initialState,
    /* latestVersionNumber */ 1,
    /* stateTimeout */ stateTimeout.toHexString(),
    /* outcomeType */ outcomeType,
    /* multisig */ stateChannel.multisigAddress,
    meta,
    /* latestAction */ undefined,
    twoPartyOutcomeInterpreterParams,
    multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
  );

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

/**
 * Returns the parameters for two hard-coded possible interpreter types.
 *
 * Note that this is _not_ a built-in part of the protocol. Here we are _restricting_
 * all newly installed AppInstances to be either of type COIN_TRANSFER or
 * TWO_PARTY_FIXED_OUTCOME. In the future, we will be extending the ProtocolParams.Install
 * to indidicate the interpreterAddress and interpreterParams so the developers
 * installing apps have more control, however for now we are putting this logic
 * inside of the client (the Node) by adding an "outcomeType" variable which
 * is a simplification of the actual decision a developer has to make with their app.
 *
 * TODO: update doc on how MultiAssetMultiPartyCoinTransferInterpreterParams work
 *
 * @param {OutcomeType} outcomeType - either COIN_TRANSFER or TWO_PARTY_FIXED_OUTCOME
 * @param {utils.BigNumber} initiatorBalanceDecrement - amount Wei initiator deposits
 * @param {utils.BigNumber} responderBalanceDecrement - amount Wei responder deposits
 * @param {string} initiatorFbAddress - the address of the recipient of initiator
 * @param {string} responderFbAddress - the address of the recipient of responder
 *
 * @returns An object with the required parameters for both interpreter types, one
 * will be undefined and the other will be a correctly structured POJO. The AppInstance
 * object currently accepts both in its constructor and internally manages them.
 */
export function computeInterpreterParameters(
  outcomeType: OutcomeType,
  initiatorAssetId: AssetId,
  responderAssetId: AssetId,
  initiatorBalanceDecrement: utils.BigNumber,
  responderBalanceDecrement: utils.BigNumber,
  initiatorFbAddress: string,
  responderFbAddress: string,
  disableLimit: boolean,
): {
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParams;
  multiAssetMultiPartyCoinTransferInterpreterParams?: MultiAssetMultiPartyCoinTransferInterpreterParams;
  singleAssetTwoPartyCoinTransferInterpreterParams?: SingleAssetTwoPartyCoinTransferInterpreterParams;
} {
  const initiatorDepositAssetId = getAddressFromAssetId(initiatorAssetId);
  const responderDepositAssetId = getAddressFromAssetId(responderAssetId);
  switch (outcomeType) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      if (initiatorDepositAssetId !== responderDepositAssetId) {
        throw new Error(
          TWO_PARTY_OUTCOME_DIFFERENT_ASSETS(initiatorDepositAssetId, responderDepositAssetId),
        );
      }

      return {
        twoPartyOutcomeInterpreterParams: {
          tokenAddress: initiatorDepositAssetId,
          playerAddrs: [initiatorFbAddress, responderFbAddress],
          amount: initiatorBalanceDecrement.add(responderBalanceDecrement),
        },
      };
    }

    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: {
      return initiatorDepositAssetId === responderDepositAssetId
        ? {
            multiAssetMultiPartyCoinTransferInterpreterParams: {
              limit: [initiatorBalanceDecrement.add(responderBalanceDecrement)],
              tokenAddresses: [initiatorDepositAssetId],
            },
          }
        : {
            multiAssetMultiPartyCoinTransferInterpreterParams: {
              limit: [initiatorBalanceDecrement, responderBalanceDecrement],
              tokenAddresses: [initiatorDepositAssetId, responderDepositAssetId],
            },
          };
    }

    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
      if (initiatorDepositAssetId !== responderDepositAssetId) {
        throw new Error(
          TWO_PARTY_OUTCOME_DIFFERENT_ASSETS(initiatorDepositAssetId, responderDepositAssetId),
        );
      }

      return {
        singleAssetTwoPartyCoinTransferInterpreterParams: {
          limit: disableLimit
            ? MaxUint256
            : initiatorBalanceDecrement.add(responderBalanceDecrement),
          tokenAddress: initiatorDepositAssetId,
        },
      };
    }

    default: {
      throw new Error("The outcome type in this application logic contract is not supported yet.");
    }
  }
}
