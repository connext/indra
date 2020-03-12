import { Injectable, HttpService, Inject } from "@nestjs/common";
import { convertWithrawAppState } from "@connext/apps";
import { WithdrawApp } from "@connext/types";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreTypes, xpubToAddress } from "../util";
import { TransactionResponse, AppInstanceJson, BigNumber, ProtocolTypes, stringify, CoinTransfer, WithdrawAppState, WithdrawParameters, WithdrawAppAction } from "@connext/types";
import { HashZero, Zero, AddressZero } from "ethers/constants";
import { recoverAddress, SigningKey, joinSignature, bigNumberify } from "ethers/utils";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { WithdrawRepository} from "../withdraw/withdraw.repository";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { Withdraw } from "./withdraw.entity";

@Injectable()
export class WithdrawService {
    constructor(
        private readonly cfCoreService: CFCoreService,
        private readonly configService: ConfigService,
        private readonly onchainTransactionService: OnchainTransactionService,
        private readonly log: LoggerService,
        private readonly onchainTransactionRepository: OnchainTransactionRepository,
        private readonly appRegistryRepository: AppRegistryRepository,
        private readonly withdrawRepository: WithdrawRepository,
        private readonly channelRepository: ChannelRepository,
    ) {
    this.log.setContext("ChannelService");
    }

    /*
        Called in the case that node wants to withdraw funds from channel
    */
    async withdraw(
      multisigAddress: string,
      amount: BigNumber,
      assetId: string = AddressZero,
    ): Promise<void> {
      const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
      if (!channel) {
        throw new Error(`No channel exists for multisigAddress ${multisigAddress}`);
      }
  
      // don't allow withdraw if user's balance refund app is installed
      const balanceRefundApp = await this.cfCoreService.getCoinBalanceRefundApp(
        multisigAddress,
        assetId,
      );
      if (
        balanceRefundApp &&
        balanceRefundApp.latestState[`recipient`] === xpubToAddress(channel.userPublicIdentifier)
      ) {
        throw new Error(
          `Cannot deposit, user's CoinBalanceRefundApp is installed for ${channel.userPublicIdentifier}`,
        );
      }
  
      if (
        balanceRefundApp &&
        balanceRefundApp.latestState[`recipient`] === this.cfCoreService.cfCore.freeBalanceAddress
      ) {
        this.log.info(`Removing node's installed CoinBalanceRefundApp before depositing`);
        await this.cfCoreService.rescindDepositRights(channel.multisigAddress, assetId);
      }

      return this.proposeWithdrawApp(amount, assetId, channel);
    }

      /*
        Primary response method to user withdrawal. Called from appRegistry service.
      */
    async handleUserWithdraw(appInstance: AppInstanceJson): Promise<void> {
        let state = appInstance.latestState as WithdrawAppState<BigNumber>;

        // Create the same commitment from scratch
        const generatedCommitment = await this.cfCoreService.createWithdrawCommitment(
          {
            amount: state.transfers[0].amount,
            assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
            recipient: state.transfers[0].to
          } as WithdrawParameters<BigNumber>,
          appInstance.multisigAddress
        )
    
        // Sign commitment
        const key = new SigningKey(this.configService.getEthWallet().privateKey)
        const counterpartySignatureOnWithdrawCommitment = joinSignature(key.signDigest(generatedCommitment.hashToSign()))

        await this.cfCoreService.takeAction(appInstance.identityHash, {signature: counterpartySignatureOnWithdrawCommitment} as WithdrawAppAction);
        state = (await this.cfCoreService.getAppState(appInstance.identityHash)).state as WithdrawAppState<BigNumber>;

        // Update the db entity with signature
        let withdraw = await this.withdrawRepository.findByAppInstanceId(appInstance.identityHash);
        if(!withdraw) {
          this.log.error(`Unable to find withdraw entity that we just took action upon. AppId ${appInstance.identityHash}`)
        }
        await this.withdrawRepository.addCounterpartySignatureAndFinalize(withdraw, counterpartySignatureOnWithdrawCommitment);

        await this.cfCoreService.uninstallApp(appInstance.identityHash)

        // Get a finalized minTx object and put it onchain
        const signedWithdrawalCommitment = generatedCommitment.getSignedTransaction(state.signatures);
        const transaction = await this.submitWithdrawToChain(
          appInstance.multisigAddress,
          signedWithdrawalCommitment
        );

        // Update db entry again
        withdraw = await this.withdrawRepository.findByAppInstanceId(appInstance.identityHash);
        if(!withdraw) {
          this.log.error(`Unable to find withdraw entity that we just uninstalled. AppId ${appInstance.identityHash}`)
        }

        const onchainTransaction = await this.onchainTransactionRepository.findByHash(transaction.hash)
        if(!onchainTransaction) {
          this.log.error(`Unable to find onchain tx that we just submitted in db. Hash: ${transaction.hash}`)
        }

        await this.withdrawRepository.addOnchainTransaction(withdraw, onchainTransaction);
        this.log.info(`Node responded with transaction: ${transaction.hash}`);
        this.log.debug(`Transaction details: ${stringify(transaction)}`);
        return;
    }

    async submitWithdrawToChain(
      multisigAddress: string,
      tx: CFCoreTypes.MinimalTransaction,
    ): Promise<TransactionResponse> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);

    const { transactionHash: deployTx } = await this.cfCoreService.deployMultisig(
      channel.multisigAddress,
    );
    this.log.debug(`Deploy multisig tx: ${deployTx}`);

    const wallet = this.configService.getEthWallet();
    if (deployTx !== HashZero) {
      this.log.debug(`Waiting for deployment transaction...`);
      wallet.provider.waitForTransaction(deployTx);
      this.log.debug(`Deployment transaction complete!`);
    } else {
      this.log.debug(`Multisig already deployed, proceeding with withdrawal`);
    }

    this.log.debug(`Sending withdrawal to chain`)
    const txRes = await this.onchainTransactionService.sendWithdrawal(channel, tx);
    this.log.debug(`Withdrawal tx sent! Hash: ${txRes.hash}`)
    return txRes;
  }

  async saveWithdrawal(
      appInstanceId: string,
      amount: BigNumber,
      assetId: string,
      recipient: string,
      data: string,
      withdrawerSignature: string,
      counterpartySignature: string,
      multisigAddress: string,
    ) {
      const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      const withdraw = new Withdraw();
      withdraw.appInstanceId = appInstanceId;
      withdraw.amount = amount;
      withdraw.assetId = assetId;
      withdraw.recipient = recipient;
      withdraw.data = data;
      withdraw.withdrawerSignature = withdrawerSignature;
      withdraw.counterpartySignature = counterpartySignature;
      withdraw.finalized = false;
      withdraw.channel = channel;
      return await this.withdrawRepository.save(withdraw);
  }

  async getLatestWithdrawal(userPublicIdentifier: string): Promise<OnchainTransaction | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userPublicIdentifier ${userPublicIdentifier}`);
    }

    return await this.onchainTransactionRepository.findLatestWithdrawalByUserPublicIdentifier(
      userPublicIdentifier,
    );
  }

  private async proposeWithdrawApp(
    amount: BigNumber,
    assetId: string,
    channel: Channel
  ): Promise<void> {

    const commitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount,
        assetId,
        recipient: this.cfCoreService.cfCore.freeBalanceAddress
      } as WithdrawParameters<BigNumber>,
      channel.multisigAddress,
    );

    const signingKey = new SigningKey(this.configService.getEthWallet().privateKey)
    const withdrawerSignatureOnCommitment = joinSignature(signingKey.signDigest(commitment.hashToSign()));

    const transfers: CoinTransfer[] = [
      {amount: amount.toString(), to: this.cfCoreService.cfCore.freeBalanceAddress},
      {amount: Zero.toString(), to: xpubToAddress(channel.userPublicIdentifier)}
    ]

    const initialState: WithdrawAppState = {
      transfers: [transfers[0],transfers[1]],
      signatures: [withdrawerSignatureOnCommitment, HashZero],
      signers: [this.cfCoreService.cfCore.freeBalanceAddress, xpubToAddress(channel.userPublicIdentifier)],
      data: commitment.hashToSign(),
      finalized: false
    };

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = await this.appRegistryRepository.findByNameAndNetwork(WithdrawApp, (await this.configService.getEthNetwork()).chainId)

    const params: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: channel.userPublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    // propose install + wait for client confirmation
    const { appInstanceId } = await this.cfCoreService.proposeAndWaitForAccepted(params, channel.multisigAddress);

    await this.saveWithdrawal(
      appInstanceId,
      bigNumberify(params.initiatorDeposit),
      params.initiatorDepositTokenAddress,
      initialState.transfers[0].to,
      initialState.data,
      initialState.signatures[0],
      initialState.signatures[1],
      channel.multisigAddress,
    )

    return;
  }
}