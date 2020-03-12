import { AddressZero, Zero, HashZero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { formatEther } from "ethers/utils";

import { stringify, withdrawalKey, xpubToAddress } from "../lib";
import {
  BigNumber,
  CFCoreTypes
} from "../types";
import { convertWithdrawParameters } from "@connext/apps";

import { AbstractController } from "./AbstractController";
import { chan_storeSet, EventNames, WITHDRAWAL_STARTED_EVENT, WITHDRAWAL_CONFIRMED_EVENT, AppInstanceJson, WithdrawResponse, WithdrawParameters, WithdrawAppState, WithdrawAppAction, WithdrawApp } from "@connext/types";
import { WithdrawERC20Commitment, WithdrawETHCommitment } from "@connext/cf-core";

export class WithdrawalController extends AbstractController {
  public async withdraw(paramsRaw: WithdrawParameters): Promise<WithdrawResponse> {
    //Set defaults
    if(!paramsRaw.assetId) {
      paramsRaw.assetId = AddressZero
    }
    if(!paramsRaw.recipient) {
      paramsRaw.recipient = this.connext.freeBalanceAddress
    }

    const params = convertWithdrawParameters(`bignumber`, paramsRaw);
    let transaction: TransactionResponse | undefined;

    this.log.info(
      `Withdrawing ${formatEther(params.amount)} ${
        params.assetId === AddressZero ? "ETH" : "Tokens"
      } from multisig to ${params.recipient}`,
    );

    await this.cleanupPendingDeposit(params.assetId); //TODO try to remove this with deposit redesign

    const withdrawCommitment = await this.createWithdrawCommitment(params);
    const withdrawerSignatureOnWithdrawCommitment = await this.connext.channelProvider.signWithdrawCommitment(withdrawCommitment.hashToSign());
    
    await this.proposeWithdrawApp(params, withdrawCommitment.hashToSign(), withdrawerSignatureOnWithdrawCommitment);

    this.connext.listener.emit(EventNames[WITHDRAWAL_STARTED_EVENT], {params,
    withdrawCommitment, withdrawerSignatureOnWithdrawCommitment})

    transaction = await this.connext.watchForUserWithdrawal();
    this.log.info(`Node put withdrawal onchain: ${transaction.hash}`);
    this.log.debug(`Transaction details: ${stringify(transaction)}`);

    this.connext.listener.emit(EventNames[WITHDRAWAL_CONFIRMED_EVENT], {transaction})

    // Note that we listen for the signed commitment and save it to store only in listener.ts

    return {transaction};
  }

  public async respondToNodeWithdraw(appInstance: AppInstanceJson) {
    const state = appInstance.latestState as WithdrawAppState<BigNumber>;

    const generatedCommitment = await this.createWithdrawCommitment({
      amount: state.transfers[0].amount,
      assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
      recipient: state.transfers[0].to
    } as WithdrawParameters<BigNumber>)

    // Dont need to validate anything because we already did it during the propose flow
    const counterpartySignatureOnWithdrawCommitment = await this.connext.channelProvider.signWithdrawCommitment(generatedCommitment);
    await this.connext.takeAction(appInstance.identityHash, {signature: counterpartySignatureOnWithdrawCommitment} as WithdrawAppAction);
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

  private async createWithdrawCommitment(params: WithdrawParameters<BigNumber>): Promise<WithdrawETHCommitment | WithdrawERC20Commitment> {
    const { assetId, amount, recipient } = params;
    const channel = await this.connext.getStateChannel();
    if ( assetId === AddressZero) {
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

  private async proposeWithdrawApp(params: WithdrawParameters<BigNumber>, withdrawCommitmentHash: string, withdrawerSignatureOnWithdrawCommitment: string): Promise<string> {
    const { amount, recipient, assetId } = params;
    const appInfo = this.connext.getRegisteredAppDetails(WithdrawApp);
    const { appDefinitionAddress: appDefinition, outcomeType, stateEncoding, actionEncoding } = appInfo;
    const initialState: WithdrawAppState<BigNumber>  = {
      transfers: [{amount: amount, to: recipient}, {amount: Zero, to: xpubToAddress(this.connext.nodePublicIdentifier)}],
      signatures: [withdrawerSignatureOnWithdrawCommitment, HashZero],
      signers: [xpubToAddress(this.connext.publicIdentifier), xpubToAddress(this.connext.nodePublicIdentifier)],
      data: withdrawCommitmentHash,
      finalized: false
    }
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

  public async saveWithdrawCommitmentToStore(params: WithdrawParameters<BigNumber>, signatures: string[]): Promise<void> {
    // set the withdrawal tx in the store
    const commitment = await this.createWithdrawCommitment(params);
    const minTx: CFCoreTypes.MinimalTransaction = commitment.getSignedTransaction(signatures)
    await this.connext.channelProvider.send(chan_storeSet, {
      pairs: [
        { path: withdrawalKey(this.connext.publicIdentifier), value: { tx: minTx, retry: 0 } },
      ],
    });
    return;
  }
}
