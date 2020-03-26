import {
  WithdrawERC20Commitment,
  WithdrawETHCommitment,
} from "@connext/apps";
import {
  AppInstanceJson,
  ChannelMethods,
  EventNames,
  MethodParams,
  MinimalTransaction,
  toBN,
  WithdrawAppName,
  WithdrawAppAction,
  WithdrawAppState,
  WithdrawParameters,
  WithdrawResponse,
} from "@connext/types";
import { AddressZero, Zero, HashZero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { formatEther } from "ethers/utils";

import { stringify, xpubToAddress } from "../lib";
import { invalidAddress, validate } from "../validation";

import { AbstractController } from "./AbstractController";

export class WithdrawalController extends AbstractController {
  public async withdraw(params: WithdrawParameters): Promise<WithdrawResponse> {
    //Set defaults
    if (!params.assetId) {
      params.assetId = AddressZero;
    }

    if (!params.recipient) {
      params.recipient = this.connext.freeBalanceAddress;
    }

    const amount = toBN(params.amount);
    const { assetId, recipient } = params;
    let transaction: TransactionResponse | undefined;

    if (recipient) {
      validate(invalidAddress(recipient));
    }

    this.log.info(
      `Withdrawing ${formatEther(amount)} ${
        assetId === AddressZero ? "ETH" : "Tokens"
      } from multisig to ${recipient}`,
    );

    // TODO: try to remove this with deposit redesign
    await this.cleanupPendingDeposit(assetId);

    const withdrawCommitment = await this.createWithdrawCommitment(params);
    const hash = withdrawCommitment.hashToSign();
    const withdrawerSignatureOnWithdrawCommitment = await this.connext.channelProvider.signDigest(
      hash,
    );

    await this.proposeWithdrawApp(params, hash, withdrawerSignatureOnWithdrawCommitment);

    this.connext.listener.emit(EventNames.WITHDRAWAL_STARTED_EVENT, {
      params,
      withdrawCommitment,
      withdrawerSignatureOnWithdrawCommitment,
    });

    transaction = await this.connext.watchForUserWithdrawal();
    this.log.info(`Node put withdrawal onchain: ${transaction.hash}`);
    this.log.debug(`Transaction details: ${stringify(transaction)}`);

    this.connext.listener.emit(EventNames.WITHDRAWAL_CONFIRMED_EVENT, { transaction });

    // Note that we listen for the signed commitment and save it to store only in listener.ts

    return { transaction };
  }

  public async respondToNodeWithdraw(appInstance: AppInstanceJson) {
    const state = appInstance.latestState as WithdrawAppState;

    const generatedCommitment = await this.createWithdrawCommitment({
      amount: state.transfers[0].amount,
      assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
      recipient: state.transfers[0].to,
    } as WithdrawParameters);
    const hash = generatedCommitment.hashToSign();

    // Dont need to validate anything because we already did it during the propose flow
    const counterpartySignatureOnWithdrawCommitment = await this.connext.channelProvider.signDigest(
      hash,
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
    params: WithdrawParameters,
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
    params: WithdrawParameters,
    withdrawCommitmentHash: string,
    withdrawerSignatureOnWithdrawCommitment: string,
  ): Promise<string> {
    const amount = toBN(params.amount);
    const { recipient, assetId } = params;
    const appInfo = this.connext.getRegisteredAppDetails(WithdrawAppName);
    const {
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
      actionEncoding,
    } = appInfo;
    const initialState: WithdrawAppState = {
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
    const installParams: MethodParams.ProposeInstall = {
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
    params: WithdrawParameters,
    signatures: string[],
  ): Promise<void> {
    // set the withdrawal tx in the store
    const commitment = await this.createWithdrawCommitment(params);
    commitment.signatures = signatures as any;
    const minTx: MinimalTransaction = await commitment.getSignedTransaction();
    const value = { tx: minTx, retry: 0 };
    await this.connext.channelProvider.send(ChannelMethods.chan_setUserWithdrawal, { ...value });
    await this.connext.channelProvider.send(
      ChannelMethods.chan_setUserWithdrawal,
      { withdrawalObject: value },
    );
    return;
  }
}
