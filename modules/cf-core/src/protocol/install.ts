import { MaxUint256 } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { SetStateCommitment, ConditionalTransactionCommitment } from "../ethereum";
import { Opcode, Protocol, xkeyKthAddress, Commitment } from "../machine";
import { AppInstance, StateChannel, TokenIndexedCoinTransferMap } from "../models";
import {
  Context,
  InstallProtocolParams,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  NetworkContext,
  OutcomeType,
  ProtocolExecutionFlow,
  ProtocolMessage,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
} from "../types";
import { assertSufficientFundsWithinFreeBalance, logTime } from "../utils";

import { assertIsValidSignature, UNASSIGNED_SEQ_NO } from "./utils";
import { TWO_PARTY_OUTCOME_DIFFERENT_ASSETS } from "../methods";

const { OP_SIGN, IO_SEND, IO_SEND_AND_WAIT, WRITE_COMMITMENT, PERSIST_STATE_CHANNEL } = Opcode;
const { Install } = Protocol;
const { Conditional, SetState } = Commitment;

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

  0 /* Initiating */: async function*(context: Context) {
    const {
      store,
      message: { params, processID },
      network,
    } = context;
    const log = context.log.newContext("CF-InstallProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Initiation started`);

    const {
      responderXpub,
      multisigAddress,
      initiatorDepositTokenAddress,
      responderDepositTokenAddress,
      initiatorBalanceDecrement,
      responderBalanceDecrement,
      initiatorXpub,
    } = params as InstallProtocolParams;

    const preProtocolStateChannel = await store.getStateChannel(multisigAddress);

    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      initiatorXpub,
      initiatorDepositTokenAddress,
      initiatorBalanceDecrement,
    );

    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      responderXpub,
      responderDepositTokenAddress,
      responderBalanceDecrement,
    );

    const postProtocolStateChannel = computeStateChannelTransition(
      preProtocolStateChannel,
      params as InstallProtocolParams,
    );

    const newAppInstance = postProtocolStateChannel.mostRecentlyInstalledAppInstance();

    const conditionalTransactionData = constructConditionalTransactionData(
      network,
      postProtocolStateChannel,
    );

    const responderFreeBalanceAddress = xkeyKthAddress(responderXpub, 0);

    // free balance addr signs conditional transactions
    const mySignatureOnConditionalTransaction = yield [OP_SIGN, conditionalTransactionData];

    substart = Date.now();
    const {
      customData: {
        signature: counterpartySignatureOnConditionalTransaction,
        signature2: counterpartySignatureOnFreeBalanceStateUpdate,
      },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        params,
        protocol: Install,
        toXpub: responderXpub,
        customData: {
          signature: mySignatureOnConditionalTransaction,
        },
        seq: 1,
      } as ProtocolMessage,
    ];
    logTime(log, substart, `Received responder's sigs on conditional tx & balance update`);

    // free balance addr signs conditional transactions
    substart = Date.now();
    assertIsValidSignature(
      responderFreeBalanceAddress,
      conditionalTransactionData,
      counterpartySignatureOnConditionalTransaction,
    );
    logTime(log, substart, `Validated responder's sig on conditional tx`);

    conditionalTransactionData.signatures = [
      mySignatureOnConditionalTransaction,
      counterpartySignatureOnConditionalTransaction,
    ];

    yield [WRITE_COMMITMENT, Conditional, conditionalTransactionData, newAppInstance.identityHash];

    const freeBalanceUpdateData = new SetStateCommitment(
      network.ChallengeRegistry,
      postProtocolStateChannel.freeBalance.identity,
      postProtocolStateChannel.freeBalance.hashOfLatestState,
      postProtocolStateChannel.freeBalance.versionNumber,
      postProtocolStateChannel.freeBalance.timeout,
    );

    // always use free balance key to sign free balance update
    substart = Date.now();
    assertIsValidSignature(
      responderFreeBalanceAddress,
      freeBalanceUpdateData,
      counterpartySignatureOnFreeBalanceStateUpdate,
    );
    logTime(log, substart, `Validated responder's sig on free balance update`);

    // always use free balance key to sign free balance update
    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateData];

    // add signatures to commitment
    freeBalanceUpdateData.signatures = [
      mySignatureOnFreeBalanceStateUpdate,
      counterpartySignatureOnFreeBalanceStateUpdate,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      freeBalanceUpdateData,
      postProtocolStateChannel.freeBalance.identityHash,
    ];

    yield [PERSIST_STATE_CHANNEL, [postProtocolStateChannel]];

    substart = Date.now();
    yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        protocol: Install,
        toXpub: responderXpub,
        customData: {
          signature: mySignatureOnFreeBalanceStateUpdate,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessage,
    ];
    logTime(log, substart, `Received responder's confirmation that they received our sig`);
    logTime(log, start, `Finished Initiating`);
  },

  /**
   * Sequence 1 of the INSTALL_PROTOCOL requires the responder party
   * to countersignsign the ConditionalTransactionCommitment and then sign
   * the update to the free balance object, wait for the intitiating party to
   * sign _that_ and then finish the protocol.
   *
   * @param {Context} context
   */

  1 /* Responding */: async function*(context: Context) {
    const {
      store,
      message: {
        params,
        processID,
        customData: { signature },
      },
      network,
    } = context;
    const log = context.log.newContext("CF-InstallProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Response started`);

    // Aliasing `signature` to this variable name for code clarity
    const counterpartySignatureOnConditionalTransaction = signature;

    const {
      initiatorXpub,
      multisigAddress,
      responderBalanceDecrement,
      responderXpub,
      responderDepositTokenAddress,
      initiatorBalanceDecrement,
      initiatorDepositTokenAddress,
    } = params as InstallProtocolParams;

    const preProtocolStateChannel = await store.getStateChannel(multisigAddress);

    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      initiatorXpub,
      initiatorDepositTokenAddress,
      initiatorBalanceDecrement,
    );

    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      responderXpub,
      responderDepositTokenAddress,
      responderBalanceDecrement,
    );

    const postProtocolStateChannel = computeStateChannelTransition(
      preProtocolStateChannel,
      params as InstallProtocolParams,
    );

    const initiatorFreeBalanceAddress = xkeyKthAddress(initiatorXpub, 0);

    const newAppInstance = postProtocolStateChannel.mostRecentlyInstalledAppInstance();

    const conditionalTransactionData = constructConditionalTransactionData(
      network,
      postProtocolStateChannel,
    );

    // multisig owner always signs conditional tx
    substart = Date.now();
    assertIsValidSignature(
      initiatorFreeBalanceAddress,
      conditionalTransactionData,
      counterpartySignatureOnConditionalTransaction,
    );
    logTime(log, substart, `Validated initiator's sig on conditional tx data`);

    const mySignatureOnConditionalTransaction = yield [OP_SIGN, conditionalTransactionData];

    conditionalTransactionData.signatures = [
      mySignatureOnConditionalTransaction,
      counterpartySignatureOnConditionalTransaction,
    ];

    yield [WRITE_COMMITMENT, Conditional, conditionalTransactionData, newAppInstance.identityHash];

    const freeBalanceUpdateData = new SetStateCommitment(
      network.ChallengeRegistry,
      postProtocolStateChannel.freeBalance.identity,
      postProtocolStateChannel.freeBalance.hashOfLatestState,
      postProtocolStateChannel.freeBalance.versionNumber,
      postProtocolStateChannel.freeBalance.timeout,
    );

    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateData];

    substart = Date.now();
    const {
      customData: { signature: counterpartySignatureOnFreeBalanceStateUpdate },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        protocol: Install,
        toXpub: initiatorXpub,
        customData: {
          signature: mySignatureOnConditionalTransaction,
          signature2: mySignatureOnFreeBalanceStateUpdate,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessage,
    ];
    logTime(log, substart, `Received initiator's sig on free balance update`);

    // always use freeBalanceAddress to sign updates
    substart = Date.now();
    assertIsValidSignature(
      initiatorFreeBalanceAddress,
      freeBalanceUpdateData,
      counterpartySignatureOnFreeBalanceStateUpdate,
    );
    logTime(log, substart, `Validated initiator's sig on free balance update`);

    // add signature
    freeBalanceUpdateData.signatures = [
      mySignatureOnFreeBalanceStateUpdate,
      counterpartySignatureOnFreeBalanceStateUpdate,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      freeBalanceUpdateData,
      postProtocolStateChannel.freeBalance.identityHash,
    ];

    yield [PERSIST_STATE_CHANNEL, [postProtocolStateChannel]];

    const m4 = {
      processID,
      protocol: Install,
      toXpub: initiatorXpub,
      customData: {
        dataPersisted: true,
      },
      seq: UNASSIGNED_SEQ_NO,
    } as ProtocolMessage;

    yield [IO_SEND, m4];
    logTime(log, start, `Finished responding`);
  },
};

/**
 * Generates the would-be new StateChannel to represent the final state of the
 * StateChannel after the protocol would be executed with correct signatures.
 *
 * @param {StateChannel} stateChannel - The pre-protocol state of the channel
 * @param {InstallProtocolParams} params - Parameters about the new AppInstance
 *
 * @returns {Promise<StateChannel>} - The post-protocol state of the channel
 */
function computeStateChannelTransition(
  stateChannel: StateChannel,
  params: InstallProtocolParams,
): StateChannel {
  const {
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    initiatorDepositTokenAddress,
    responderDepositTokenAddress,
    initiatorXpub,
    responderXpub,
    participants,
    initialState,
    appInterface,
    defaultTimeout,
    appSeqNo,
    outcomeType,
    disableLimit,
  } = params;

  const initiatorFbAddress = stateChannel.getFreeBalanceAddrOf(initiatorXpub);
  const responderFbAddress = stateChannel.getFreeBalanceAddrOf(responderXpub);

  const {
    multiAssetMultiPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
  } = computeInterpreterParameters(
    outcomeType,
    initiatorDepositTokenAddress,
    responderDepositTokenAddress,
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    initiatorFbAddress,
    responderFbAddress,
    disableLimit,
  );

  const appInstanceToBeInstalled = new AppInstance(
    /* participants */ participants,
    /* defaultTimeout */ defaultTimeout,
    /* appInterface */ appInterface,
    /* isVirtualApp */ false,
    /* appSeqNo */ appSeqNo,
    /* latestState */ initialState,
    /* latestVersionNumber */ 0,
    /* defaultTimeout */ defaultTimeout,
    /* outcomeType */ outcomeType,
    twoPartyOutcomeInterpreterParams,
    multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
  );

  let tokenIndexedBalanceDecrement: TokenIndexedCoinTransferMap;
  if (initiatorDepositTokenAddress !== responderDepositTokenAddress) {
    tokenIndexedBalanceDecrement = {
      [initiatorDepositTokenAddress]: {
        [initiatorFbAddress]: initiatorBalanceDecrement,
      },
      [responderDepositTokenAddress]: {
        [responderFbAddress]: responderBalanceDecrement,
      },
    };
  } else {
    // If the decrements are on the same token, the previous block
    // sets the decrement only on the `respondingFbAddress` and the
    // `initiatingFbAddress` would get overwritten
    tokenIndexedBalanceDecrement = {
      [initiatorDepositTokenAddress]: {
        [initiatorFbAddress]: initiatorBalanceDecrement,
        [responderFbAddress]: responderBalanceDecrement,
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
 * TWO_PARTY_FIXED_OUTCOME. In the future, we will be extending the InstallProtocolParams
 * to indidicate the interpreterAddress and interpreterParams so the developers
 * installing apps have more control, however for now we are putting this logic
 * inside of the client (the Node) by adding an "outcomeType" variable which
 * is a simplification of the actual decision a developer has to make with their app.
 *
 * TODO: update doc on how MultiAssetMultiPartyCoinTransferInterpreterParams work
 *
 * @param {OutcomeType} outcomeType - either COIN_TRANSFER or TWO_PARTY_FIXED_OUTCOME
 * @param {BigNumber} initiatorBalanceDecrement - amount Wei initiator deposits
 * @param {BigNumber} responderBalanceDecrement - amount Wei responder deposits
 * @param {string} initiatorFbAddress - the address of the recipient of initiator
 * @param {string} responderFbAddress - the address of the recipient of responder
 *
 * @returns An object with the required parameters for both interpreter types, one
 * will be undefined and the other will be a correctly structured POJO. The AppInstance
 * object currently accepts both in its constructor and internally manages them.
 */
function computeInterpreterParameters(
  outcomeType: OutcomeType,
  initiatorDepositTokenAddress: string,
  responderDepositTokenAddress: string,
  initiatorBalanceDecrement: BigNumber,
  responderBalanceDecrement: BigNumber,
  initiatorFbAddress: string,
  responderFbAddress: string,
  disableLimit: boolean,
): {
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParams;
  // eslint-disable-next-line max-len
  multiAssetMultiPartyCoinTransferInterpreterParams?: MultiAssetMultiPartyCoinTransferInterpreterParams;
  // eslint-disable-next-line max-len
  singleAssetTwoPartyCoinTransferInterpreterParams?: SingleAssetTwoPartyCoinTransferInterpreterParams;
} {
  switch (outcomeType) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      if (initiatorDepositTokenAddress !== responderDepositTokenAddress) {
        throw Error(
          TWO_PARTY_OUTCOME_DIFFERENT_ASSETS(
            initiatorDepositTokenAddress,
            responderDepositTokenAddress,
          ),
        );
      }

      return {
        twoPartyOutcomeInterpreterParams: {
          tokenAddress: initiatorDepositTokenAddress,
          playerAddrs: [initiatorFbAddress, responderFbAddress],
          amount: initiatorBalanceDecrement.add(responderBalanceDecrement),
        },
      };
    }

    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: {
      return initiatorDepositTokenAddress === responderDepositTokenAddress
        ? {
            multiAssetMultiPartyCoinTransferInterpreterParams: {
              limit: [initiatorBalanceDecrement.add(responderBalanceDecrement)],
              tokenAddresses: [initiatorDepositTokenAddress],
            },
          }
        : {
            multiAssetMultiPartyCoinTransferInterpreterParams: {
              limit: [initiatorBalanceDecrement, responderBalanceDecrement],
              tokenAddresses: [initiatorDepositTokenAddress, responderDepositTokenAddress],
            },
          };
    }

    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
      if (initiatorDepositTokenAddress !== responderDepositTokenAddress) {
        throw Error(
          TWO_PARTY_OUTCOME_DIFFERENT_ASSETS(
            initiatorDepositTokenAddress,
            responderDepositTokenAddress,
          ),
        );
      }

      return {
        singleAssetTwoPartyCoinTransferInterpreterParams: {
          limit: disableLimit
            ? MaxUint256
            : initiatorBalanceDecrement.add(responderBalanceDecrement),
          tokenAddress: initiatorDepositTokenAddress,
        },
      };
    }

    default: {
      throw Error("The outcome type in this application logic contract is not supported yet.");
    }
  }
}

/**
 * Computes the ConditionalTransactionCommitment unsigned transaction from the multisignature
 * wallet that is required to be signed by all parties involved in the protocol.
 *
 * @param {NetworkContext} network - Metadata on the current blockchain
 * @param {OutcomeType} outcomeType - The outcome type of the AppInstance
 * @param {StateChannel} stateChannel - The post-protocol StateChannel
 *
 * @returns {ConditionalTransactionCommitment} A ConditionalTransactionCommitment object, ready to sign.
 */
function constructConditionalTransactionData(
  networkContext: NetworkContext,
  stateChannel: StateChannel,
): ConditionalTransactionCommitment {
  const appInstance = stateChannel.mostRecentlyInstalledAppInstance();
  return new ConditionalTransactionCommitment(
    networkContext,
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    appInstance.identityHash,
    stateChannel.freeBalance.identityHash,
    getInterpreterAddressFromOutcomeType(appInstance.outcomeType, networkContext),
    appInstance.encodedInterpreterParams,
  );
}

function getInterpreterAddressFromOutcomeType(
  outcomeType: OutcomeType,
  networkContext: NetworkContext,
) {
  switch (outcomeType) {
    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: {
      return networkContext.MultiAssetMultiPartyCoinTransferInterpreter;
    }
    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
      return networkContext.SingleAssetTwoPartyCoinTransferInterpreter;
    }
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      return networkContext.TwoPartyFixedOutcomeInterpreter;
    }
    default: {
      throw Error("The outcome type in this application logic contract is not supported yet.");
    }
  }
}
