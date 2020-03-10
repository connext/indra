import { Injectable, HttpService, Inject } from "@nestjs/common";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreTypes, xpubToAddress } from "../util";
import { TransactionResponse, AppInstanceJson, BigNumber, ProtocolTypes } from "@connext/types";
import { HashZero, Zero } from "ethers/constants";
import { recoverAddress, SigningKey, joinSignature } from "ethers/utils";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";

@Injectable()
export class WithdrawService {
    constructor(
        private readonly cfCoreService: CFCoreService,
        private readonly channelRepository: ChannelRepository,
        private readonly configService: ConfigService,
        private readonly onchainTransactionService: OnchainTransactionService,
        private readonly log: LoggerService,
        private readonly httpService: HttpService,
        private readonly onchainTransactionRepository: OnchainTransactionRepository,
        private readonly appRegistryRepository: AppRegistryRepository,
    ) {
    this.log.setContext("ChannelService");
    }

    async withdrawForClient(
      userPublicIdentifier: string,
      tx: CFCoreTypes.MinimalTransaction,
    ): Promise<TransactionResponse> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userPublicIdentifier ${userPublicIdentifier}`);
    }

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

    const txRes = await this.onchainTransactionService.sendUserWithdrawal(channel, tx);
    return txRes;
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

  async respondToUserWithdraw(appInstance: AppInstanceJson): Promise<void> {
    const state = appInstance.latestState as WithdrawAppState<BigNumber>;

    const generatedCommitment = await this.cfCoreService.createWithdrawCommitment({
      amount: state.transfers[0].amount,
      assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
      recipient: state.transfers[0].to
    } as WithdrawParameters<BigNumber>,
    appInstance.multisigAddress
    )

    const channel = await this.channelRepository.findByMultisigAddress(appInstance.multisigAddress);
    const recoveredSigner = recoverAddress(generatedCommitment.hashToSign(), state.signatures[0]);

    if(generatedCommitment.hashToSign() !== state.data) {
      throw new Error(`Generated withdraw commitment did not match commitment from initial state: ${generatedCommitment.hashToSign()} vs ${state.data}`)
    }

    if(recoveredSigner !== state.signers[0]) {
      throw new Error(`Recovered signer did not match signer in app state: ${recoveredSigner} vs ${state.signers[0]}`)
    }

    if(recoveredSigner !== xpubToAddress(channel.userPublicIdentifier)) {
      throw new Error(`Recoverd signer did not match user's signer: ${recoveredSigner} vs ${xpubToAddress(channel.userPublicIdentifier)}`)
    }

    if(state.transfers[1].amount !== Zero) {
      throw new Error(`Will not withdraw - our transfer amount is not equal to zero`)
    }

    const counterpartySignatureOnWithdrawCommitment = await this.configService.getEthWallet().signMessage(generatedCommitment.hashToSign())
    await this.cfCoreService.takeAction(appInstance.identityHash, {signature: counterpartySignatureOnWithdrawCommitment} as WithdrawAppAction);
  }

  async finalizeWithdraw(appInstance: AppInstanceJson): Promise<TransactionResponse> {
    const state = appInstance.latestState as WithdrawAppState<BigNumber>;
    await this.cfCoreService.uninstallApp(appInstance.identityHash)
    const commitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount: state.transfers[0].amount,
        recipient: state.transfers[0].to,
        assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress
      } as WithdrawParameters<BigNumber>,
      appInstance.multisigAddress
    )
    const signedWithdrawalCommitment = commitment.getSignedTransaction([
      state.signatures[0],
      state.signatures[1],
    ]);
    const transaction = await this.withdrawForClient(
      (await this.channelRepository.findByMultisigAddress(appInstance.multisigAddress)).userPublicIdentifier,
      signedWithdrawalCommitment
    );
    this.log.info(`Node responded with transaction: ${transaction.hash}`);
    this.log.debug(`Transaction details: ${stringify(transaction)}`);
    return transaction;
  }

  private async proposeWithdrawApp(
    amount: BigNumber,
    assetId: string,
    channel: Channel
  ): Promise<ProtocolTypes.ProposeInstallResult> {

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
    const prefix = "0x0";

    const initialState: WithdrawAppState = {
      transfers: [transfers[0],transfers[1]],
      signatures: [withdrawerSignatureOnCommitment, prefix.padEnd(66, "0")],
      signers: [this.cfCoreService.cfCore.freeBalanceAddress, xpubToAddress(channel.userPublicIdentifier)],
      data: commitment.hashToSign(),
      finalized: false
    };

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = await this.configService.getDefaultAppByName(WithdrawApp);

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
    return this.cfCoreService.proposeAndWaitForAccepted(params, channel.multisigAddress);
  }

  async initiateWithdraw(
    multisigAddress: string,
    amount: BigNumber,
    assetId: string = AddressZero,
  ): Promise<AppInstanceJson> {
    return new Promise(async (resolve): Promise<void> => {
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

      const result = await this.proposeWithdrawApp(amount, assetId, channel);
      const {appInstance} = await this.cfCoreService.installApp(result.appInstanceId);
      resolve(appInstance);
    })
  }
}