import { MaxUint256 } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS, UNASSIGNED_SEQ_NO } from "../constants";
import {
  getConditionalTxCommitment,
  SetStateCommitment,
  WithdrawERC20Commitment,
  WithdrawETHCommitment,
} from "../ethereum";
import { AppInstance, StateChannel } from "../models";
import {
  coinBalanceRefundStateEncoding,
  Context,
  NetworkContext,
  Opcode,
  OutcomeType,
  Protocol,
  ProtocolExecutionFlow,
  ProtocolMessage,
  WithdrawProtocolParams,
} from "../types";
import { logTime } from "../utils";
import { xkeyKthAddress } from "../xkeys";

import { assertIsValidSignature } from "./utils";

const { IO_SEND, IO_SEND_AND_WAIT, OP_SIGN, PERSIST_STATE_CHANNEL, WRITE_COMMITMENT } = Opcode;
const { Install, Update, Withdraw } = Protocol;
/**
 * @description This exchange is described at the following URL:
 * https://specs.counterfactual.com/11-withdraw-protocol *
 */
export const WITHDRAW_PROTOCOL: ProtocolExecutionFlow = {
  /**
   * Sequence 0 of the WITHDRAW_PROTOCOL looks a bit like this:
   *
   * 1. Sign a `ConditionalTxCommitment` for an ETHBalanceRefund AppInstance
   * 2. Get the countersignature, then sign the FreeBalance state update to activate
   * 3. Sign the WithdrawETHCommitment and wait for counterparty
   * 4. Countersign the uninstallation FreeBalance state update
   *
   * Effectively you are installing an ETHBalanceRefund such that all funds above
   * some value in the multisignature wallet belong to you, then signing the actual
   * withdrawal transaction from the multisignature wallet, then uninstalling the
   * ETHBalanceRefund which is worthless after this point since signing the withdrawal
   * transaction on the multisignature wallet is equivalent to spending the money.
   *
   * @param {Context} context - Persistent object for duration of the protocol
   *        that includes lots of information about the current state of the user's
   *        channel, the parameters being passed in, and any messages received.
   */

  0 /* Initiating */: async function*(context: Context) {
    const {
      stateChannelsMap,
      message: { params, processID },
      network,
    } = context;
    const log = context.log.newContext("CF-WithdrawProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Initiation started`);

    const {
      responderXpub,
      multisigAddress,
      recipient,
      amount,
      tokenAddress,
    } = params as WithdrawProtocolParams;

    const preInstallRefundAppStateChannel = stateChannelsMap.get(multisigAddress)!;

    const postInstallRefundAppStateChannel = addRefundAppToStateChannel(
      preInstallRefundAppStateChannel,
      params as WithdrawProtocolParams,
      network,
    );

    const refundApp = postInstallRefundAppStateChannel.mostRecentlyInstalledAppInstance();

    const conditionalTransactionData = getConditionalTxCommitment(
      context,
      postInstallRefundAppStateChannel,
      refundApp,
    );

    const responderFreeBalanceAddress = preInstallRefundAppStateChannel.getFreeBalanceAddrOf(
      responderXpub,
    );

    const responderEphemeralKey = xkeyKthAddress(responderXpub, refundApp.appSeqNo);

    // free balance address signs conditional transaction data
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
        protocol: Withdraw,
        toXpub: responderXpub,
        customData: {
          signature: mySignatureOnConditionalTransaction,
        },
        seq: 1,
      } as ProtocolMessage,
    ];
    logTime(log, substart, `Received responder's sigs on the conditional tx + free balance update`);

    // free balance address signs conditional transaction data
    substart = Date.now();
    assertIsValidSignature(
      responderFreeBalanceAddress,
      conditionalTransactionData,
      counterpartySignatureOnConditionalTransaction,
    );
    logTime(log, substart, `Verified responder's sig on the conditional tx`);

    const signedConditionalTransaction = conditionalTransactionData.getSignedTransaction([
      mySignatureOnConditionalTransaction,
      counterpartySignatureOnConditionalTransaction,
    ]);

    context.stateChannelsMap.set(
      postInstallRefundAppStateChannel.multisigAddress,
      postInstallRefundAppStateChannel,
    );

    yield [
      WRITE_COMMITMENT,
      Install, // NOTE: The WRITE_COMMITMENT API is awkward in this situation
      signedConditionalTransaction,
      refundApp.identityHash,
    ];

    const freeBalanceUpdateData = new SetStateCommitment(
      network,
      postInstallRefundAppStateChannel.freeBalance.identity,
      postInstallRefundAppStateChannel.freeBalance.hashOfLatestState,
      postInstallRefundAppStateChannel.freeBalance.versionNumber,
      postInstallRefundAppStateChannel.freeBalance.timeout,
    );

    // always use free balance address to sign free balance app updates
    substart = Date.now();
    assertIsValidSignature(
      responderFreeBalanceAddress,
      freeBalanceUpdateData,
      counterpartySignatureOnFreeBalanceStateUpdate,
    );
    logTime(log, substart, `Verified responder's sigs on the free balance update`);

    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateData];

    const signedFreeBalanceStateUpdate = freeBalanceUpdateData.getSignedTransaction([
      mySignatureOnFreeBalanceStateUpdate,
      counterpartySignatureOnFreeBalanceStateUpdate,
    ]);

    yield [
      WRITE_COMMITMENT,
      Update, // NOTE: The WRITE_COMMITMENT API is awkward in this situation
      signedFreeBalanceStateUpdate,
      postInstallRefundAppStateChannel.freeBalance.identityHash,
    ];

    // free balance address signs withdrawal transaction data
    const withdrawCommitment = constructWithdrawalCommitment(
      postInstallRefundAppStateChannel,
      recipient,
      amount,
      tokenAddress,
    );

    // free balance address signs withdrawal transaction data
    const mySignatureOnWithdrawalCommitment = yield [OP_SIGN, withdrawCommitment];

    substart = Date.now();
    const {
      customData: {
        signature: counterpartySignatureOnWithdrawalCommitment,
        signature2: counterpartySignatureOnUninstallCommitment,
      },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        protocol: Withdraw,
        toXpub: responderXpub,
        customData: {
          signature: mySignatureOnFreeBalanceStateUpdate,
          signature2: mySignatureOnWithdrawalCommitment,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessage,
    ];
    logTime(log, substart, `Received responder's sig on the withdrawal + uninstall commitments`);

    // free balance address signs withdrawal transaction data
    substart = Date.now();
    assertIsValidSignature(
      responderFreeBalanceAddress,
      withdrawCommitment,
      counterpartySignatureOnWithdrawalCommitment,
    );
    logTime(log, substart, `Verified responder's sig on the withdrawal commitment`);

    const postUninstallRefundAppStateChannel = postInstallRefundAppStateChannel.uninstallApp(
      refundApp.identityHash,
      {},
    );

    context.stateChannelsMap.set(
      postUninstallRefundAppStateChannel.multisigAddress,
      postUninstallRefundAppStateChannel,
    );

    const uninstallRefundAppCommitment = new SetStateCommitment(
      network,
      postUninstallRefundAppStateChannel.freeBalance.identity,
      postUninstallRefundAppStateChannel.freeBalance.hashOfLatestState,
      postUninstallRefundAppStateChannel.freeBalance.versionNumber,
      postUninstallRefundAppStateChannel.freeBalance.timeout,
    );

    // ephemeral key signs refund app
    substart = Date.now();
    assertIsValidSignature(
      responderEphemeralKey,
      uninstallRefundAppCommitment,
      counterpartySignatureOnUninstallCommitment,
    );
    logTime(log, substart, `Verified responder's sig on the uninstall commitment`);

    // ephemeral key signs refund app
    const mySignatureOnUninstallCommitment = yield [
      OP_SIGN,
      uninstallRefundAppCommitment,
      refundApp.appSeqNo,
    ];

    substart = Date.now();
    yield [
      IO_SEND_AND_WAIT,
      {
        protocol: Withdraw,
        processID: context.message.processID,
        toXpub: responderXpub,
        customData: {
          signature: mySignatureOnUninstallCommitment,
        },
        seq: UNASSIGNED_SEQ_NO,
      },
    ];
    logTime(log, substart, `Received responder's confirmation that they got our sigs`);

    const signedWithdrawalCommitment = withdrawCommitment.getSignedTransaction([
      mySignatureOnWithdrawalCommitment,
      counterpartySignatureOnWithdrawalCommitment,
    ]);

    yield [WRITE_COMMITMENT, Withdraw, signedWithdrawalCommitment, multisigAddress];

    const signedUninstallCommitment = uninstallRefundAppCommitment.getSignedTransaction([
      mySignatureOnUninstallCommitment,
      counterpartySignatureOnUninstallCommitment,
    ]);

    yield [
      WRITE_COMMITMENT,
      Update, // NOTE: The WRITE_COMMITMENT API is awkward in this situation
      signedUninstallCommitment,
      postUninstallRefundAppStateChannel.freeBalance.identityHash,
    ];

    yield [PERSIST_STATE_CHANNEL, [postUninstallRefundAppStateChannel]];
    logTime(log, start, `Finished Initiating`);
  },

  /**
   * Sequence 1 of the WITHDRAW_PROTOCOL looks very similar but the inverse:
   *
   * 1. Countersign the received `ConditionalTxCommitment` from the initiator
   * 2. Sign the free balance state update to install the AppInstance and send
   * 3. Countersign the WithdrawETHCommitment you receive back
   * 4. Sign and send the FreeBalance state update and wait for the countersignature
   *
   * @param {Context} context - Persistent object for duration of the protocol
   *        that includes lots of information about the current state of the user's
   *        channel, the parameters being passed in, and any messages received.
   */

  1 /* Responding */: async function*(context: Context) {
    const {
      stateChannelsMap,
      message: { params, processID, customData },
      network,
    } = context;
    const log = context.log.newContext("CF-WithdrawProtocol");
    const start = Date.now();
    let substart;
    log.debug(`Response started`);

    // Aliasing `signature` to this variable name for code clarity
    const counterpartySignatureOnConditionalTransaction = customData.signature;

    const {
      initiatorXpub,
      multisigAddress,
      recipient,
      amount,
      tokenAddress,
    } = params as WithdrawProtocolParams;

    const preInstallRefundAppStateChannel = stateChannelsMap.get(multisigAddress)!;

    const postInstallRefundAppStateChannel = addRefundAppToStateChannel(
      preInstallRefundAppStateChannel,
      params as WithdrawProtocolParams,
      network,
    );

    const refundApp = postInstallRefundAppStateChannel.mostRecentlyInstalledAppInstance();

    const conditionalTransactionData = getConditionalTxCommitment(
      context,
      postInstallRefundAppStateChannel,
      refundApp,
    );

    const initiatorFreeBalanceAddress = preInstallRefundAppStateChannel.getFreeBalanceAddrOf(
      initiatorXpub,
    );

    const initiatorEphemeralKey = xkeyKthAddress(initiatorXpub, refundApp.appSeqNo);

    // free balance address signs conditional transaction data
    assertIsValidSignature(
      initiatorFreeBalanceAddress,
      conditionalTransactionData,
      counterpartySignatureOnConditionalTransaction,
    );

    // free balance address signs conditional transaction data
    const mySignatureOnConditionalTransaction = yield [OP_SIGN, conditionalTransactionData];

    const signedConditionalTransaction = conditionalTransactionData.getSignedTransaction([
      mySignatureOnConditionalTransaction,
      counterpartySignatureOnConditionalTransaction,
    ]);

    context.stateChannelsMap.set(
      postInstallRefundAppStateChannel.multisigAddress,
      postInstallRefundAppStateChannel,
    );

    yield [
      WRITE_COMMITMENT,
      Install, // NOTE: The WRITE_COMMITMENT API is awkward in this situation
      signedConditionalTransaction,
      refundApp.identityHash,
    ];

    const freeBalanceUpdateData = new SetStateCommitment(
      network,
      postInstallRefundAppStateChannel.freeBalance.identity,
      postInstallRefundAppStateChannel.freeBalance.hashOfLatestState,
      postInstallRefundAppStateChannel.freeBalance.versionNumber,
      postInstallRefundAppStateChannel.freeBalance.timeout,
    );

    // always use fb address to sign free balance updates
    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateData];

    substart = Date.now();
    const {
      customData: {
        signature: counterpartySignatureOnFreeBalanceStateUpdate,
        signature2: counterpartySignatureOnWithdrawalCommitment,
      },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        protocol: Withdraw,
        toXpub: initiatorXpub,
        customData: {
          signature: mySignatureOnConditionalTransaction,
          signature2: mySignatureOnFreeBalanceStateUpdate,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessage,
    ];
    logTime(log, substart, `Received initiator's sigs on balance update & withdraw commitment`);

    // always use fb address to sign free balance updates
    substart = Date.now();
    assertIsValidSignature(
      initiatorFreeBalanceAddress,
      freeBalanceUpdateData,
      counterpartySignatureOnFreeBalanceStateUpdate,
    );
    logTime(log, substart, `Verified initiator's sig on balance update`);

    const signedFreeBalanceStateUpdate = freeBalanceUpdateData.getSignedTransaction([
      mySignatureOnFreeBalanceStateUpdate,
      counterpartySignatureOnFreeBalanceStateUpdate,
    ]);

    yield [
      WRITE_COMMITMENT,
      Update, // NOTE: The WRITE_COMMITMENT API is awkward in this situation
      signedFreeBalanceStateUpdate,
      postInstallRefundAppStateChannel.freeBalance.identityHash,
    ];

    const withdrawCommitment = constructWithdrawalCommitment(
      postInstallRefundAppStateChannel,
      recipient,
      amount,
      tokenAddress,
    );

    // free balance address signs withdraw commitment
    assertIsValidSignature(
      initiatorFreeBalanceAddress,
      withdrawCommitment,
      counterpartySignatureOnWithdrawalCommitment,
    );

    // free balance address signs withdraw commitment
    const mySignatureOnWithdrawalCommitment = yield [OP_SIGN, withdrawCommitment];

    const signedWithdrawalCommitment = withdrawCommitment.getSignedTransaction([
      mySignatureOnWithdrawalCommitment,
      counterpartySignatureOnWithdrawalCommitment,
    ]);

    yield [WRITE_COMMITMENT, Withdraw, signedWithdrawalCommitment, multisigAddress];

    const postUninstallRefundAppStateChannel = postInstallRefundAppStateChannel.uninstallApp(
      refundApp.identityHash,
      {},
    );

    context.stateChannelsMap.set(
      postUninstallRefundAppStateChannel.multisigAddress,
      postUninstallRefundAppStateChannel,
    );

    const uninstallRefundAppCommitment = new SetStateCommitment(
      network,
      postUninstallRefundAppStateChannel.freeBalance.identity,
      postUninstallRefundAppStateChannel.freeBalance.hashOfLatestState,
      postUninstallRefundAppStateChannel.freeBalance.versionNumber,
      postUninstallRefundAppStateChannel.freeBalance.timeout,
    );

    const mySignatureOnUninstallCommitment = yield [
      OP_SIGN,
      uninstallRefundAppCommitment,
      refundApp.appSeqNo,
    ];

    substart = Date.now();
    const {
      customData: { signature: counterpartySignatureOnUninstallCommitment },
    } = yield [
      IO_SEND_AND_WAIT,
      {
        processID,
        protocol: Withdraw,
        toXpub: initiatorXpub,
        customData: {
          signature: mySignatureOnWithdrawalCommitment,
          signature2: mySignatureOnUninstallCommitment,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessage,
    ];
    logTime(log, substart, `Received initator's sig on uninstall commitment`);

    substart = Date.now();
    assertIsValidSignature(
      initiatorEphemeralKey,
      uninstallRefundAppCommitment,
      counterpartySignatureOnUninstallCommitment,
    );
    logTime(log, substart, `Verified initator's sig on uninstall commitment`);

    const signedUninstallCommitment = uninstallRefundAppCommitment.getSignedTransaction([
      mySignatureOnUninstallCommitment,
      counterpartySignatureOnUninstallCommitment,
    ]);

    yield [
      WRITE_COMMITMENT,
      Update, // NOTE: The WRITE_COMMITMENT API is awkward in this situation
      signedUninstallCommitment,
      postUninstallRefundAppStateChannel.freeBalance.identityHash,
    ];

    yield [PERSIST_STATE_CHANNEL, [postUninstallRefundAppStateChannel]];

    yield [
      IO_SEND,
      {
        processID,
        protocol: Withdraw,
        toXpub: initiatorXpub,
        customData: {
          dataPersisted: true,
        },
        seq: UNASSIGNED_SEQ_NO,
      } as ProtocolMessage,
    ];
    logTime(log, start, `Finished responding`);
  },
};

/**
 * Adds an ETHBalanceRefundApp to the StateChannel object passed in based on
 * parameters also passed in with recipient and amount information.
 *
 * @param {StateChannel} stateChannel - the pre-install-refund-app StateChannel
 * @param {WithdrawProtocolParams} params - params with recipient and amount
 * @param {NetworkContext} network - metadata on the addresses on the chain
 *
 * @returns {StateChannel} - the same StateChannel with an ETHBalanceRefundApp added
 */
function addRefundAppToStateChannel(
  stateChannel: StateChannel,
  params: WithdrawProtocolParams,
  network: NetworkContext,
): StateChannel {
  const { recipient, amount, multisigAddress, initiatorXpub, tokenAddress } = params;

  const defaultTimeout = 1008;

  // TODO: Use a wrapper function for making new AppInstance objects.
  const refundAppInstance = new AppInstance(
    stateChannel.getNextSigningKeys(),
    defaultTimeout,
    {
      addr: network.CoinBalanceRefundApp,
      stateEncoding: coinBalanceRefundStateEncoding,
      actionEncoding: undefined,
    },
    false,
    stateChannel.numProposedApps,
    {
      recipient,
      multisig: multisigAddress,
      threshold: amount,
    },
    0,
    defaultTimeout,
    OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    undefined,
    undefined,
    { tokenAddress, limit: MaxUint256 },
  );

  return stateChannel.installApp(refundAppInstance, {
    [tokenAddress]: {
      [stateChannel.getFreeBalanceAddrOf(initiatorXpub)]: amount,
    },
  });
}

function constructWithdrawalCommitment(
  postInstallRefundAppStateChannel: StateChannel,
  recipient: string,
  amount: BigNumber,
  tokenAddress: string,
) {
  if (tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
    return new WithdrawETHCommitment(
      postInstallRefundAppStateChannel.multisigAddress,
      postInstallRefundAppStateChannel.multisigOwners,
      recipient,
      amount,
    );
  }
  return new WithdrawERC20Commitment(
    postInstallRefundAppStateChannel.multisigAddress,
    postInstallRefundAppStateChannel.multisigOwners,
    recipient,
    amount,
    tokenAddress,
  );
}
