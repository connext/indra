import { AddressZero, Zero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { bigNumberify, formatEther, getAddress, AbiCoder, recoverAddress } from "ethers/utils";

import { stringify, withdrawalKey, xpubToAddress } from "../lib";
import {
  BigNumber,
  CFCoreTypes,
  convert,
  WithdrawalResponse,
  WithdrawParameters,
} from "../types";
import { invalidAddress, notLessThanOrEqualTo, notPositive, validate } from "../validation";

import { AbstractController } from "./AbstractController";
import { chan_storeSet, EventNames, WITHDRAWAL_STARTED_EVENT, WITHDRAWAL_CONFIRMED_EVENT, WithdrawAppState, WithdrawAppAction, UPDATE_STATE_EVENT } from "@connext/types";
import { WithdrawERC20Commitment, WithdrawETHCommitment } from "@connext/cf-core";
const ETH_ADDRESS = AddressZero

export class WithdrawalController extends AbstractController {
  public async withdraw(paramsRaw: WithdrawParameters): Promise<WithdrawalResponse> {
    /*
      Withdrawal steps:
      1. Validate params
      2. Ensure that a deposit isn't currently in progress -- this should eventually be obviated
      3. Create and sign withdraw commitment
      4. Install withdraw app
      5. Emit the withdrawal_started event
      6. Setup listener for takeAction on that app
      7. On event catch, save doublesigned commitment to store
      8. Uninstall the app
      9. If userSubmitted, deploy multisig onchain
      10. If userSubmitted, retrieve commitment from store and attempt to put onchain
      11. Else, wait for node to emit withdraw_finished with txHash?
      12. Emit the withdraw_finished event (should contain commitment and txHash)

      Failure cases:
      1. WithdrawApp uninstalled without being finalized --> set up listener for uninstall and emit withdrawal_failed
      2. UserSubmitted withdraw tx fails --> emit withdraw_failed
      3. No node submitted withdraw tx within time period?
    */
    return new Promise( async (resolve,reject): Promise<void> => {
      const params = convert.Withdraw(`bignumber`, paramsRaw);
      let transaction: TransactionResponse | undefined;
  
      await this.validateWithdrawParams(params);
  
      this.log.info(
        `Withdrawing ${formatEther(params.amount)} ${
          params.assetId === AddressZero ? "ETH" : "Tokens"
        } from multisig to ${params.recipient}`,
      );
  
      await this.cleanupPendingDeposit(params.assetId);
  
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
  
          // If userSubmitted, then attempt to put commitment onchain
          if(params.userSubmitted) {
            // TODO ARJUN build out this codepath
            await this.deployMultisig();
            transaction = await this.attemptUserSubmittedWithdraw();
          } else {
            transaction = await this.connext.watchForUserWithdrawal();
            this.log.info(`Node responded with transaction: ${transaction.hash}`);
            this.log.debug(`Transaction details: ${stringify(transaction)}`);
          }
          this.connext.listener.emit(EventNames[WITHDRAWAL_CONFIRMED_EVENT], {transaction})
          this.connext.listener.removeListener(EventNames[UPDATE_STATE_EVENT], () => {});
          resolve({
            apps: await this.connext.getAppInstances(this.connext.multisigAddress),
            freeBalance: await this.connext.getFreeBalance(),
            transaction,
          });
        }
      })
    })
  }
  
  /* In case of counterparty withdrawal:
  1. Set up listener on client start
  2. On counterparty install of withdrawApp, call respondToCounterpartyWithdraw() in controller
  3. Validate the withdraw commitment in initial state against provided params
  4. If ok, countersign the withdraw commitment and takeAction.

  Misc:
  (a) Cleanup finalized but not uninstalled withdraw apps on client start
  (b) Set timeout on withdrawal within which we assume the node is offline? For now we can skip this
  (c) Resolve or reject all promises
  */
  public async respondToCounterpartyWithdraw(data: any) {
    const generatedCommitment = await this.createWithdrawCommitment({
      amount: data.amount,
      assetId: data.assetId,
      recipient: data.recipient
    } as WithdrawParameters<BigNumber>)

    const recoveredSigner = recoverAddress(generatedCommitment.hashToSign(), data.withdrawerSignatureOnWithdrawCommitment)

    if(generatedCommitment !== data.withdrawCommitment) {
      throw new Error(`Generated withdraw commitment did not match commitment from initial state: ${generatedCommitment} vs ${data.withdrawCommitment}`)
    }

    if(recoveredSigner !== data.signer[0]) {
      throw new Error(`Recovered signer did not match signer in app state: ${recoveredSigner} vs ${data.signer[0]}`)
    }

    if(recoveredSigner !== xpubToAddress(this.connext.nodePublicIdentifier)) {
      throw new Error(`Recoverd signer did not match node's signer: ${recoveredSigner} vs ${xpubToAddress(this.connext.nodePublicIdentifier)}`)
    }

    //TODO ARJUN validate our cointransfers amount is zero

    const counterpartySignatureOnWithdrawCommitment = await this.connext.channelProvider.signWithdrawCommitment(generatedCommitment);
    await this.connext.takeAction(data.appId, {signature: counterpartySignatureOnWithdrawCommitment} as WithdrawAppAction);
  }

  private async validateWithdrawParams(params: WithdrawParameters<BigNumber>): Promise<void> {
    const { assetId, amount, recipient } = params;
    const preWithdrawalBal = await this.connext.getFreeBalance(assetId)[this.connext.freeBalanceAddress];
    validate(
      notPositive(amount),
      notLessThanOrEqualTo(amount, preWithdrawalBal),
    );
    if(assetId) {
      validate(invalidAddress(assetId));
    }
    if (recipient) {
      validate(invalidAddress(recipient));
    }
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
    const appInfo = this.connext.getRegisteredAppDetails("WithdrawApp");
    const { appDefinitionAddress: appDefinition, outcomeType, stateEncoding, actionEncoding } = appInfo;
    const initialState: WithdrawAppState = {
      transfers: [{amount: amount.toString(), to: recipient}, {amount: Zero.toString(), to: xpubToAddress(this.connext.nodePublicIdentifier)}],
      signatures: [withdrawerSignatureOnWithdrawCommitment, ""],
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

  //TODO ARJUN do we want this?
  private async attemptUserSubmittedWithdraw(): Promise<TransactionResponse> {
    return {} as TransactionResponse;
  }
}
