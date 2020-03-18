<<<<<<< HEAD
import { ChannelMethods, MethodNames, MinimalTransaction, toBN } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { bigNumberify, formatEther, getAddress } from "ethers/utils";

import { stringify } from "../lib";
import {
  WithdrawalResponse,
  WithdrawParameters,
} from "../types";
import { invalidAddress, notLessThanOrEqualTo, notPositive, validate } from "../validation";
=======
import {
  convertWithdrawParameters,
  WithdrawERC20Commitment,
  WithdrawETHCommitment,
} from "@connext/apps";
import {
  EventNames,
  WITHDRAWAL_STARTED_EVENT,
  WITHDRAWAL_CONFIRMED_EVENT,
  AppInstanceJson,
  WithdrawResponse,
  WithdrawParameters,
  WithdrawAppState,
  WithdrawAppAction,
  WithdrawApp,
} from "@connext/types";
import { AddressZero, Zero, HashZero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { formatEther } from "ethers/utils";

import { stringify, xpubToAddress } from "../lib";
import { BigNumber, CFCoreTypes, chan_setUserWithdrawal } from "../types";
>>>>>>> 845-store-refactor

import { AbstractController } from "./AbstractController";

export class WithdrawalController extends AbstractController {
  public async withdraw(paramsRaw: WithdrawParameters): Promise<WithdrawResponse> {
    //Set defaults
    if (!paramsRaw.assetId) {
      paramsRaw.assetId = AddressZero;
    }
<<<<<<< HEAD
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const amount = toBN(params.amount);
    const { assetId, recipient, userSubmitted } = params;
    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preWithdrawalBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notPositive(amount),
      notLessThanOrEqualTo(amount, preWithdrawalBal),
      invalidAddress(assetId), // check address of asset
    );
    if (recipient) {
      validate(invalidAddress(recipient));
=======
    if (!paramsRaw.recipient) {
      paramsRaw.recipient = this.connext.freeBalanceAddress;
>>>>>>> 845-store-refactor
    }

    const params = convertWithdrawParameters(`bignumber`, paramsRaw);
    let transaction: TransactionResponse | undefined;

    this.log.info(
      `Withdrawing ${formatEther(params.amount)} ${
        params.assetId === AddressZero ? "ETH" : "Tokens"
      } from multisig to ${params.recipient}`,
    );

<<<<<<< HEAD
    let transaction: TransactionResponse | undefined;
    try {
      this.log.info(`Rescinding deposit rights before withdrawal`);
      await this.connext.rescindDepositRights({ assetId });
      if (!userSubmitted) {
        const withdrawResponse = await this.connext.withdrawCommitment(amount, assetId, recipient);
        this.log.info(`WithdrawCommitment submitted`);
        this.log.debug(`Details of submitted withdrawal: ${stringify(withdrawResponse)}`);
        const minTx: MinimalTransaction = withdrawResponse.transaction;
        // set the withdrawal tx in the store
        await this.connext.channelProvider.send(ChannelMethods.chan_setUserWithdrawal, {
          withdrawalObject: { tx: minTx, retry: 0 },
        });

        transaction = await this.node.withdraw(minTx);

        await this.connext.watchForUserWithdrawal();

        this.log.info(`Node responded with transaction: ${transaction.hash}`);
        this.log.debug(`Transaction details: ${stringify(transaction)}`);
      } else {
        // first deploy the multisig
        const deployRes = await this.connext.deployMultisig();
        this.log.info(`Deploying multisig: ${deployRes.transactionHash}`);
        this.log.debug(`Multisig deploy transaction: ${stringify(deployRes)}`);
        if (deployRes.transactionHash !== AddressZero) {
          // wait for multisig deploy transaction
          // will be 0x000.. if the multisig has already been deployed.
          this.ethProvider.waitForTransaction(deployRes.transactionHash);
        }
        this.log.info(`Calling ${MethodNames.chan_withdraw}`);
        // user submitting the withdrawal
        const withdrawResponse = await this.connext.providerWithdraw(
          assetId,
          bigNumberify(amount),
          recipient,
        );
        this.log.info(`Node responded with transaction: ${withdrawResponse.txHash}`);
        this.log.debug(`Withdraw Response: ${stringify(withdrawResponse)}`);
        transaction = await this.ethProvider.getTransaction(withdrawResponse.txHash);
      }
      const postWithdrawBalances = await this.connext.getFreeBalance(assetId);

      this.log.debug(`Pre-Withdraw Balances: ${stringify(preWithdrawBalances)}`);
      const expectedFreeBal = bigNumberify(preWithdrawBalances[myFreeBalanceAddress]).sub(amount);

      // sanity check the free balance decrease
      if (postWithdrawBalances && !postWithdrawBalances[myFreeBalanceAddress].eq(expectedFreeBal)) {
        this.log.error(`My free balance was not decreased by the expected amount.`);
      }

      this.log.info(`Successfully Withdrew`);
    } catch (e) {
      this.log.error(`Failed to withdraw: ${e.stack || e.message}`);
      throw new Error(e);
=======
    // TODO: try to remove this with deposit redesign
    await this.cleanupPendingDeposit(params.assetId);

    const withdrawCommitment = await this.createWithdrawCommitment(params);
    const withdrawerSignatureOnWithdrawCommitment = await this.connext.channelProvider.signWithdrawCommitment(
      withdrawCommitment.hashToSign(),
    );

    await this.proposeWithdrawApp(
      params,
      withdrawCommitment.hashToSign(),
      withdrawerSignatureOnWithdrawCommitment,
    );

    this.connext.listener.emit(EventNames[WITHDRAWAL_STARTED_EVENT], {
      params,
      withdrawCommitment,
      withdrawerSignatureOnWithdrawCommitment,
    });

    transaction = await this.connext.watchForUserWithdrawal();
    this.log.info(`Node put withdrawal onchain: ${transaction.hash}`);
    this.log.debug(`Transaction details: ${stringify(transaction)}`);

    this.connext.listener.emit(EventNames[WITHDRAWAL_CONFIRMED_EVENT], { transaction });

    // Note that we listen for the signed commitment and save it to store only in listener.ts

    return { transaction };
  }

  public async respondToNodeWithdraw(appInstance: AppInstanceJson) {
    const state = appInstance.latestState as WithdrawAppState<BigNumber>;

    const generatedCommitment = await this.createWithdrawCommitment({
      amount: state.transfers[0].amount,
      assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
      recipient: state.transfers[0].to,
    } as WithdrawParameters<BigNumber>);

    // Dont need to validate anything because we already did it during the propose flow
    const counterpartySignatureOnWithdrawCommitment = await this.connext.channelProvider.signWithdrawCommitment(
      generatedCommitment.hashToSign(),
    );
    await this.connext.takeAction(appInstance.identityHash, {
      signature: counterpartySignatureOnWithdrawCommitment,
    } as WithdrawAppAction);
    await this.connext.uninstallApp(appInstance.identityHash);
  }

  private async cleanupPendingDeposit(assetId: string) {
    /*
      TODO: We should find some way to avoid this case completely if possible.
            Otherwise, it's too easy for collisions between deposits and withdraws
            to occur, which would completely fuck up a user channel.
            Circle back after deposit redesign is done.
    */
    this.log.info(`Rescinding deposit rights before withdrawal`);
    await this.connext.rescindDepositRights({ assetId });
  }

  private async createWithdrawCommitment(
    params: WithdrawParameters<BigNumber>,
  ): Promise<WithdrawETHCommitment | WithdrawERC20Commitment> {
    const { assetId, amount, recipient } = params;
    const channel = await this.connext.getStateChannel();
    if (assetId === AddressZero) {
      return new WithdrawETHCommitment(
        channel.data.multisigAddress,
        channel.data.freeBalanceAppInstance.participants,
        recipient,
        amount,
      );
>>>>>>> 845-store-refactor
    }
    return new WithdrawERC20Commitment(
      channel.data.multisigAddress,
      channel.data.freeBalanceAppInstance.participants,
      recipient,
      amount,
      assetId,
    );
  }

  private async proposeWithdrawApp(
    params: WithdrawParameters<BigNumber>,
    withdrawCommitmentHash: string,
    withdrawerSignatureOnWithdrawCommitment: string,
  ): Promise<string> {
    const { amount, recipient, assetId } = params;
    const appInfo = this.connext.getRegisteredAppDetails(WithdrawApp);
    const {
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
      actionEncoding,
    } = appInfo;
    const initialState: WithdrawAppState<BigNumber> = {
      transfers: [
        { amount: amount, to: recipient },
        { amount: Zero, to: xpubToAddress(this.connext.nodePublicIdentifier) },
      ],
      signatures: [withdrawerSignatureOnWithdrawCommitment, HashZero],
      signers: [
        xpubToAddress(this.connext.publicIdentifier),
        xpubToAddress(this.connext.nodePublicIdentifier),
      ],
      data: withdrawCommitmentHash,
      finalized: false,
    };
    const installParams: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const appId = await this.proposeAndInstallLedgerApp(installParams);
    return appId;
  }

  public async saveWithdrawCommitmentToStore(
    params: WithdrawParameters<BigNumber>,
    signatures: string[],
  ): Promise<void> {
    // set the withdrawal tx in the store
    const commitment = await this.createWithdrawCommitment(params);
    const minTx: CFCoreTypes.MinimalTransaction = commitment.getSignedTransaction(signatures);
    const value = { tx: minTx, retry: 0 };
    await this.connext.channelProvider.send(chan_setUserWithdrawal, { ...value });
    return;
  }
}
