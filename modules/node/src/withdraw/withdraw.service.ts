import { WITHDRAW_STATE_TIMEOUT } from "@connext/apps";
import {
  AppInstanceJson,
  CoinTransfer,
  MinimalTransaction,
  PublicParams,
  WithdrawAppAction,
  WithdrawAppName,
  WithdrawAppState,
  TransactionReceipt,
  SingleAssetTwoPartyCoinTransferInterpreterParamsJson,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { BigNumber, constants, utils } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";

import { WithdrawRepository } from "./withdraw.repository";
import { Withdraw } from "./withdraw.entity";

const { HashZero, Zero, AddressZero } = constants;
const { hexlify, randomBytes } = utils;

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
        assetId: (appInstance.outcomeInterpreterParameters as SingleAssetTwoPartyCoinTransferInterpreterParamsJson)
          .tokenAddress,
        recipient: state.transfers[0].to,
        nonce: state.nonce,
      } as PublicParams.Withdraw,
      appInstance.multisigAddress,
    );

    const signer = this.configService.getSigner();

    // Sign commitment
    const hash = generatedCommitment.hashToSign();
    const counterpartySignatureOnWithdrawCommitment = await signer.signMessage(hash);

    await this.cfCoreService.takeAction(appInstance.identityHash, appInstance.multisigAddress, {
      signature: counterpartySignatureOnWithdrawCommitment,
    } as WithdrawAppAction);
    state = (await this.cfCoreService.getAppInstance(appInstance.identityHash))
      .latestState as WithdrawAppState;

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

    await this.cfCoreService.uninstallApp(appInstance.identityHash, appInstance.multisigAddress);

    await generatedCommitment.addSignatures(
      counterpartySignatureOnWithdrawCommitment, // our sig
      state.signatures[0], // user sig
    );
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

    const onchainTransaction = await this.onchainTransactionRepository.findByHash(
      transaction.transactionHash,
    );
    if (!onchainTransaction) {
      this.log.error(
        `Unable to find onchain tx that we just submitted in db. Hash: ${transaction.transactionHash}`,
      );
    }

    await this.withdrawRepository.addOnchainTransaction(withdraw, onchainTransaction);
    this.log.info(`Node responded with transaction: ${transaction.transactionHash}`);
    this.log.debug(`Transaction details: ${stringify(transaction)}`);
    return;
  }

  async submitWithdrawToChain(
    multisigAddress: string,
    tx: MinimalTransaction,
  ): Promise<TransactionReceipt> {
    this.log.info(`submitWithdrawToChain for ${multisigAddress}`);
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);

    const { transactionHash: deployTx } = await this.cfCoreService.deployMultisig(
      channel.multisigAddress,
    );
    this.log.info(`Deploy multisig tx: ${deployTx}`);

    const wallet = this.configService.getSigner();
    if (deployTx !== HashZero) {
      this.log.info(`Waiting for deployment transaction...`);
      wallet.provider.waitForTransaction(deployTx);
      this.log.info(`Deployment transaction complete!`);
    } else {
      this.log.info(`Multisig already deployed, proceeding with withdrawal`);
    }

    this.log.info(`Sending withdrawal to chain`);
    const txRes = await this.onchainTransactionService.sendWithdrawal(channel, tx);
    this.log.info(`Withdrawal tx sent! Hash: ${txRes.transactionHash}`);
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
    return this.withdrawRepository.save(withdraw);
  }

  async getLatestWithdrawal(userIdentifier: string): Promise<OnchainTransaction | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userIdentifier ${userIdentifier}`);
    }

    return this.onchainTransactionRepository.findLatestWithdrawalByUserPublicIdentifier(
      userIdentifier,
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
        recipient: this.cfCoreService.cfCore.signerAddress,
        nonce,
      } as PublicParams.Withdraw,
      channel.multisigAddress,
    );

    const signer = this.configService.getSigner();
    const hash = commitment.hashToSign();
    const withdrawerSignatureOnCommitment = await signer.signMessage(hash);

    const transfers: CoinTransfer[] = [
      { amount, to: this.cfCoreService.cfCore.signerAddress },
      { amount: Zero, to: getSignerAddressFromPublicIdentifier(channel.userIdentifier) },
    ];

    const initialState: WithdrawAppState = {
      transfers: [transfers[0], transfers[1]],
      signatures: [withdrawerSignatureOnCommitment, HashZero],
      signers: [
        this.cfCoreService.cfCore.signerAddress,
        getSignerAddressFromPublicIdentifier(channel.userIdentifier),
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
      { reason: "Node withdrawal" },
      WITHDRAW_STATE_TIMEOUT,
    );

    await this.saveWithdrawal(
      appIdentityHash,
      BigNumber.from(amount),
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
