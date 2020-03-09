import { AddressZero, Zero, HashZero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { bigNumberify, formatEther, getAddress, AbiCoder, recoverAddress } from "ethers/utils";

import { stringify, withdrawalKey, xpubToAddress } from "../lib";
import {
  BigNumber,
  CFCoreTypes
} from "../types";
import { convertWithdrawParameters, WithdrawAppState, WithdrawAppAction} from "@connext/apps";

import { AbstractController } from "./AbstractController";
import { chan_storeSet, EventNames, WITHDRAWAL_STARTED_EVENT, WITHDRAWAL_CONFIRMED_EVENT, UPDATE_STATE_EVENT, AppInstanceJson, WithdrawResponse, WithdrawParameters } from "@connext/types";
import { WithdrawERC20Commitment, WithdrawETHCommitment } from "@connext/cf-core";
const ETH_ADDRESS = AddressZero

export class WithdrawalController extends AbstractController {
  public async withdraw(paramsRaw: WithdrawParameters): Promise<WithdrawResponse> {
    return new Promise( async (resolve): Promise<void> => {
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
      
      const appInstanceId = await this.withdrawAppInstalled(params, withdrawCommitment, withdrawerSignatureOnWithdrawCommitment)
  
      this.connext.listener.emit(EventNames[WITHDRAWAL_STARTED_EVENT], {params,
      withdrawCommitment, withdrawerSignatureOnWithdrawCommitment})
      
      // TODO ARJUN what happens if no event fired? We should set timeout to reject the promise and emit withdraw_failed
      this.connext.listener.on(EventNames[UPDATE_STATE_EVENT], async (data) => {
        if(data.appInstanceId === appInstanceId) {
          const state = await this.connext.getAppState(data.appInstanceId);
          
          await this.saveWithdrawCommitmentToStore(withdrawCommitment, (state.state as any).signatures as string[]);
          await this.connext.uninstallApp(data.appInstanceId)

          transaction = await this.connext.watchForUserWithdrawal();
          this.log.info(`Node put withdrawal onchain: ${transaction.hash}`);
          this.log.debug(`Transaction details: ${stringify(transaction)}`);

          this.connext.listener.emit(EventNames[WITHDRAWAL_CONFIRMED_EVENT], {transaction})
          this.connext.listener.removeListener(EventNames[UPDATE_STATE_EVENT], () => {});

          resolve({transaction});
        }
      })
    })
  }

  public async respondToCounterpartyWithdraw(appInstance: AppInstanceJson) {
    const state = appInstance.latestState as WithdrawAppState<BigNumber>;

    const generatedCommitment = await this.createWithdrawCommitment({
      amount: state.transfers[0].amount,
      assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
      recipient: state.transfers[0].to
    } as WithdrawParameters<BigNumber>)

    // Dont need to validate anything because we already did it during the propose flow
    const counterpartySignatureOnWithdrawCommitment = await this.connext.channelProvider.signWithdrawCommitment(generatedCommitment);
    await this.connext.takeAction(appInstance.identityHash, {signature: counterpartySignatureOnWithdrawCommitment} as WithdrawAppAction);
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
    if ( assetId === ETH_ADDRESS) {
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

  private async withdrawAppInstalled(params: WithdrawParameters<BigNumber>, withdrawCommitment: any, withdrawerSignatureOnWithdrawCommitment: string): Promise<string> {
    const { amount, recipient, assetId } = params;
    const appInfo = this.connext.getRegisteredAppDetails(WithdrawApp);
    const { appDefinitionAddress: appDefinition, outcomeType, stateEncoding, actionEncoding } = appInfo;
    const initialState: WithdrawAppState  = {
      transfers: [{amount: amount.toString(), to: recipient}, {amount: Zero.toString(), to: xpubToAddress(this.connext.nodePublicIdentifier)}],
      signatures: [withdrawerSignatureOnWithdrawCommitment, HashZero],
      signers: [xpubToAddress(this.connext.publicIdentifier), xpubToAddress(this.connext.nodePublicIdentifier)],
      data: withdrawCommitment,
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
      responderDepositTokenAddress: params.assetId,
      timeout: Zero,
    };

    const appId = await this.proposeAndInstallLedgerApp(installParams);
    return appId;
  }

  private async saveWithdrawCommitmentToStore(withdrawCommitment: any, signers: string[]): Promise<void> {
    // set the withdrawal tx in the store
    // TODO ARJUN what do we actually need to save?
    // const minTx: CFCoreTypes.MinimalTransaction = withdrawResponse.transaction;
    // await this.connext.channelProvider.send(chan_storeSet, {
    //   pairs: [
    //     { path: withdrawalKey(this.connext.publicIdentifier), value: { tx: minTx, retry: 0 } },
    //   ],
    // });
    return;
  }

  // TODO ARJUN: Do we ever want to do this from the client?
  private async deployMultisig(): Promise<TransactionResponse> {
    const deployRes = await this.connext.deployMultisig();
    this.log.info(`Deploying multisig: ${deployRes.transactionHash}`);
    this.log.debug(`Multisig deploy transaction: ${stringify(deployRes)}`);
    if (deployRes.transactionHash !== AddressZero) {
      // wait for multisig deploy transaction
      // will be 0x000.. if the multisig has already been deployed.
      this.ethProvider.waitForTransaction(deployRes.transactionHash);
    }
    return await this.ethProvider.getTransaction(deployRes.transactionHash);
  }
}
