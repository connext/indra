import { signDigest } from "@connext/crypto";
import {
  AppInstanceJson,
  BigNumber,
  CoinTransfer,
  MinimalTransaction,
  stringify,
  TransactionResponse,
  WithdrawAppAction,
  WithdrawAppName,
  WithdrawAppState,
  WithdrawParameters,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { HashZero, Zero, AddressZero } from "ethers/constants";
import { bigNumberify, hexlify, randomBytes } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { xkeyKthAddress } from "../util";

import { WithdrawRepository } from "./withdraw.repository";
import { Withdraw } from "./withdraw.entity";

@Injectable()
export class WithdrawService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly configService: ConfigService,
    private readonly onchainTransactionService: OnchainTransactionService,
    private readonly log: LoggerService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
    private readonly withdrawRepository: WithdrawRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("WithdrawService");
  }

  /*
        Called in the case that node wants to withdraw funds from channel
    */
  async withdraw(
    channel: Channel,
    amount: BigNumber,
    assetId: string = AddressZero,
  ): Promise<void> {
    if (!channel) {
      throw new Error(`No channel exists for multisigAddress ${channel.multisigAddress}`);
    }
    return this.proposeWithdrawApp(amount, assetId, channel);
  }

  /*
        Primary response method to user withdrawal. Called from appRegistry service.
      */
  async handleUserWithdraw(appInstance: AppInstanceJson): Promise<void> {
    let state = appInstance.latestState as WithdrawAppState;

    // Create the same commitment from scratch
    const generatedCommitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount: state.transfers[0].amount,
        assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
        recipient: state.transfers[0].to,
        nonce: state.nonce,
      } as WithdrawParameters,
      appInstance.multisigAddress,
    );

    // Get Private Key
    const privateKey = this.configService.getEthWallet().privateKey;

    // Sign commitment
    const hash = generatedCommitment.hashToSign();
    const counterpartySignatureOnWithdrawCommitment = await signDigest(privateKey, hash);

    await this.cfCoreService.takeAction(appInstance.identityHash, {
      signature: counterpartySignatureOnWithdrawCommitment,
    } as WithdrawAppAction);
    state = (await this.cfCoreService.getAppState(appInstance.identityHash))
      .state as WithdrawAppState;

    // Update the db entity with signature
    let withdraw = await this.withdrawRepository.findByAppIdentityHash(appInstance.identityHash);
    if (!withdraw) {
      this.log.error(
        `Unable to find withdraw entity that we just took action upon. AppId ${appInstance.identityHash}`,
      );
    }
    await this.withdrawRepository.addCounterpartySignatureAndFinalize(
      withdraw,
      counterpartySignatureOnWithdrawCommitment,
    );

    await this.cfCoreService.uninstallApp(appInstance.identityHash);

    // Get a finalized minTx object and put it onchain
    // TODO: remove any casting by using Signature type
    generatedCommitment.signatures = state.signatures as any;
    const signedWithdrawalCommitment = await generatedCommitment.getSignedTransaction();
    const transaction = await this.submitWithdrawToChain(
      appInstance.multisigAddress,
      signedWithdrawalCommitment,
    );

    // Update db entry again
    withdraw = await this.withdrawRepository.findByAppIdentityHash(appInstance.identityHash);
    if (!withdraw) {
      this.log.error(
        `Unable to find withdraw entity that we just uninstalled. AppId ${appInstance.identityHash}`,
      );
    }

    const onchainTransaction = await this.onchainTransactionRepository.findByHash(transaction.hash);
    if (!onchainTransaction) {
      this.log.error(
        `Unable to find onchain tx that we just submitted in db. Hash: ${transaction.hash}`,
      );
    }

    await this.withdrawRepository.addOnchainTransaction(withdraw, onchainTransaction);
    this.log.info(`Node responded with transaction: ${transaction.hash}`);
    this.log.debug(`Transaction details: ${stringify(transaction)}`);
    return;
  }

  async submitWithdrawToChain(
    multisigAddress: string,
    tx: MinimalTransaction,
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

    this.log.debug(`Sending withdrawal to chain`);
    const txRes = await this.onchainTransactionService.sendWithdrawal(channel, tx);
    this.log.debug(`Withdrawal tx sent! Hash: ${txRes.hash}`);
    return txRes;
  }

  async saveWithdrawal(
    appIdentityHash: string,
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
    withdraw.appIdentityHash = appIdentityHash;
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
    channel: Channel,
  ): Promise<void> {
    this.log.debug(`Creating proposal for node withdraw`);
    const nonce = hexlify(randomBytes(32));

    const commitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount,
        assetId,
        recipient: this.cfCoreService.cfCore.freeBalanceAddress,
        nonce,
      } as WithdrawParameters,
      channel.multisigAddress,
    );

    const privateKey = this.configService.getEthWallet().privateKey;
    const hash = commitment.hashToSign();

    const withdrawerSignatureOnCommitment = await signDigest(privateKey, hash);

    const transfers: CoinTransfer[] = [
      { amount, to: this.cfCoreService.cfCore.freeBalanceAddress },
      { amount: Zero, to: xkeyKthAddress(channel.userPublicIdentifier) },
    ];

    const initialState: WithdrawAppState = {
      transfers: [transfers[0], transfers[1]],
      signatures: [withdrawerSignatureOnCommitment, HashZero],
      signers: [
        this.cfCoreService.cfCore.freeBalanceAddress,
        xkeyKthAddress(channel.userPublicIdentifier),
      ],
      data: hash,
      nonce,
      finalized: false,
    };

    // propose install + wait for client confirmation
    const { appIdentityHash } = await this.cfCoreService.proposeAndWaitForInstallApp(
      channel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      WithdrawAppName,
    );

    await this.saveWithdrawal(
      appIdentityHash,
      bigNumberify(amount),
      assetId,
      initialState.transfers[0].to,
      initialState.data,
      initialState.signatures[0],
      initialState.signatures[1],
      channel.multisigAddress,
    );
    return;
  }
}
