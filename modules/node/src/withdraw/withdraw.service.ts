import { WITHDRAW_STATE_TIMEOUT } from "@connext/apps";
import {
  AppInstanceJson,
  CoinTransfer,
  MinimalTransaction,
  PublicParams,
  WithdrawAppAction,
  WithdrawAppName,
  WithdrawAppState,
  SingleAssetTwoPartyCoinTransferInterpreterParamsJson,
  EventNames,
  EventPayloads,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { BigNumber, constants, utils, providers } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import {
  OnchainTransaction,
  TransactionReason,
} from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import {
  OnchainTransactionService,
  OnchainTransactionResponse,
} from "../onchainTransactions/onchainTransaction.service";

import { WithdrawRepository } from "./withdraw.repository";
import { Withdraw } from "./withdraw.entity";

const { HashZero, Zero, AddressZero } = constants;
const { hexlify, randomBytes } = utils;

@Injectable()
export class WithdrawService {
  constructor(
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly cfCoreService: CFCoreService,
    private readonly onchainTransactionService: OnchainTransactionService,
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
  ): Promise<providers.TransactionResponse> {
    // first try to deploy multisig. if this fails, cancel the withdrawal
    try {
      await this.deployMultisig(channel);
    } catch (e) {
      this.log.error(`Error deploying multisig: ${e.message}`);
      this.log.warn(`Aborting node reclaim`);
      throw e;
    }

    const { appIdentityHash, withdrawTracker } = await this.proposeWithdrawApp(
      amount,
      assetId,
      channel,
    );

    let uninstallData: EventPayloads.Uninstall;
    try {
      uninstallData = await this.cfCoreService.emitter.waitFor(
        EventNames.UNINSTALL_EVENT,
        20_000,
        (data) => data.appIdentityHash === appIdentityHash,
      );
    } catch (e) {
      this.log.error(`Error waiting for withdrawal app to be uninstalled: ${e.message}`);
      // TODO: should we uninstall ourselves here?
      throw e;
    }

    if (!uninstallData.uninstalledApp.latestState.finalized) {
      throw new Error(`Error, cannot reclaim on withdraw app that is not finalized. AppId: ${appIdentityHash}`);
    }

    const action = uninstallData!.action as WithdrawAppAction;
    await this.withdrawRepository.addCounterpartySignatureAndFinalize(
      withdrawTracker,
      action.signature,
    );
    const state = uninstallData!.uninstalledApp.latestState;
    const appInstance = uninstallData!.uninstalledApp;
    const commitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount: state.transfers[0].amount,
        // eslint-disable-next-line max-len
        assetId: (appInstance.outcomeInterpreterParameters as SingleAssetTwoPartyCoinTransferInterpreterParamsJson)
          .tokenAddress,
        recipient: this.cfCoreService.cfCore.signerAddress,
        nonce: state.nonce,
      },
      channel,
    );
    await commitment.addSignatures(state.signatures[0], state.signatures[1]);
    const tx = await commitment.getSignedTransaction();
    const updatedChannel = await this.channelRepository.findByMultisigAddressOrThrow(
      appInstance.multisigAddress,
    );
    return this.submitWithdrawToChain(
      updatedChannel,
      tx,
      appInstance.identityHash,
      TransactionReason.NODE_WITHDRAWAL,
    );
  }

  /*
    Primary response method to user withdrawal. Called from appRegistry service.
  */
  async handleUserWithdraw(appInstance: AppInstanceJson): Promise<void> {
    let state = appInstance.latestState as WithdrawAppState;
    const channel = await this.channelRepository.findByAppIdentityHashOrThrow(
      appInstance.identityHash,
    );

    // first try to deploy multisig. if this fails, cancel the withdrawal
    try {
      await this.deployMultisig(channel);
    } catch (e) {
      this.log.error(`Error deploying multisig: ${e.message}`);
      this.log.warn(
        `Cancelling user ${appInstance.initiatorIdentifier} withdrawal by uninstalling withdrawal app ${appInstance.identityHash}`,
      );
      await this.cfCoreService.uninstallApp(appInstance.identityHash, channel);
      this.log.warn(`User ${appInstance.initiatorIdentifier} withdrawal canceled`);
    }

    // Create the same commitment from scratch
    const generatedCommitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount: state.transfers[0].amount,
        // eslint-disable-next-line max-len
        assetId: (appInstance.outcomeInterpreterParameters as SingleAssetTwoPartyCoinTransferInterpreterParamsJson)
          .tokenAddress,
        recipient: state.transfers[0].to,
        nonce: state.nonce,
      } as PublicParams.Withdraw,
      channel,
    );

    const signer = this.configService.getSigner(
      (await this.channelRepository.getChainIdByMultisigAddress(appInstance.multisigAddress))!,
    );

    // Sign commitment
    const hash = generatedCommitment.hashToSign();
    const counterpartySignatureOnWithdrawCommitment = await signer.signMessage(hash);

    // take action _before_ sending tx so that there is no double spend risk
    await this.cfCoreService.takeAction(appInstance.identityHash, channel, {
      signature: counterpartySignatureOnWithdrawCommitment,
    } as WithdrawAppAction);

    state = appInstance.latestState as WithdrawAppState;

    // Update the db entity with signature
    let withdraw = await this.withdrawRepository.findByAppIdentityHash(appInstance.identityHash);
    if (!withdraw) {
      this.log.error(
        `Unable to find withdraw entity that we just took action upon. AppId ${appInstance.identityHash}`,
      );
    } else {
      await this.withdrawRepository.addCounterpartySignatureAndFinalize(
        withdraw,
        counterpartySignatureOnWithdrawCommitment,
      );
    }

    await generatedCommitment.addSignatures(
      counterpartySignatureOnWithdrawCommitment, // our sig
      state.signatures[0], // user sig
    );

    const signedWithdrawalCommitment = await generatedCommitment.getSignedTransaction();

    // try to submit the user's withdrawal tx onchain
    // uninstall withdrawal app with tx hash if it's available, otherwise do not provide
    let txRes: OnchainTransactionResponse | undefined;
    try {
      txRes = await this.submitWithdrawToChain(
        channel,
        signedWithdrawalCommitment,
        appInstance.identityHash,
        TransactionReason.USER_WITHDRAWAL,
      );
      if (!txRes) {
        throw new Error(`No tx response available after submitting to chain!`);
      }
    } catch (e) {
      this.log.error(`Unable to submit withdrawal tx: ${e.message}`);
    }

    await this.cfCoreService.uninstallApp(
      appInstance.identityHash,
      channel,
      undefined,
      { withdrawTx: txRes?.hash },
    );

    // Update db entry again
    withdraw = await this.withdrawRepository.findByAppIdentityHash(appInstance.identityHash);
    if (!withdraw) {
      this.log.error(
        `Unable to find withdraw entity that we just uninstalled. AppId ${appInstance.identityHash}`,
      );
      return;
    }

    const onchainTransaction = await this.onchainTransactionRepository.findByHash(txRes!.hash);

    await this.withdrawRepository.addUserOnchainTransaction(withdraw, onchainTransaction!);
    this.log.info(`Node responded with transaction: ${onchainTransaction!.hash}`);
    this.log.debug(`Transaction details: ${stringify(onchainTransaction)}`);
    return;
  }

  async deployMultisig(channel: Channel) {
    this.log.info(`deployMultisig for ${channel.multisigAddress}`);
    const { transactionHash: deployTx } = await this.cfCoreService.deployMultisig(
      channel.multisigAddress,
    );
    this.log.info(`Deploy multisig tx: ${deployTx}`);

    const wallet = this.configService.getSigner(channel.chainId);
    if (deployTx !== HashZero) {
      this.log.info(`Waiting for deployment transaction...`);
      wallet.provider!.waitForTransaction(deployTx);
      this.log.info(`Deployment transaction complete!`);
    } else {
      this.log.info(`Multisig already deployed`);
    }
  }

  async submitWithdrawToChain(
    channel: Channel,
    tx: MinimalTransaction,
    appIdentityHash: string,
    withdrawReason: TransactionReason.NODE_WITHDRAWAL | TransactionReason.USER_WITHDRAWAL,
  ): Promise<OnchainTransactionResponse> {
    this.log.info(`submitWithdrawToChain for ${channel.multisigAddress}`);
    let txRes: OnchainTransactionResponse;
    if (withdrawReason === TransactionReason.NODE_WITHDRAWAL) {
      txRes = await this.onchainTransactionService.sendWithdrawal(channel, tx, appIdentityHash);
    } else {
      txRes = await this.onchainTransactionService.sendUserWithdrawal(channel, tx, appIdentityHash);
    }
    this.log.info(`Withdrawal tx sent! Hash: ${txRes.hash}`);
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
  ): Promise<Withdraw> {
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

  async getLatestWithdrawal(
    userIdentifier: string,
    chainId: number,
  ): Promise<OnchainTransaction | undefined> {
    await this.channelRepository.findByUserPublicIdentifierAndChainOrThrow(userIdentifier, chainId);

    return this.onchainTransactionRepository.findLatestWithdrawalByUserPublicIdentifierAndChain(
      userIdentifier,
      chainId,
    );
  }

  private async proposeWithdrawApp(
    amount: BigNumber,
    assetId: string,
    channel: Channel,
  ): Promise<{ appIdentityHash: string; withdrawTracker: Withdraw }> {
    this.log.debug(`Creating proposal for node withdraw`);
    const nonce = hexlify(randomBytes(32));

    const commitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount,
        assetId,
        recipient: this.cfCoreService.cfCore.signerAddress,
        nonce,
      } as PublicParams.Withdraw,
      channel,
    );

    const signer = this.configService.getSigner(channel.chainId);
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
    const { appIdentityHash } = (await this.cfCoreService.proposeAndWaitForInstallApp(
      channel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      this.cfCoreService.getAppInfoByNameAndChain(WithdrawAppName, channel.chainId),
      { reason: "Node withdrawal" },
      WITHDRAW_STATE_TIMEOUT,
    ))!;

    const withdrawTracker = await this.saveWithdrawal(
      appIdentityHash,
      BigNumber.from(amount),
      assetId,
      initialState.transfers[0].to,
      initialState.data,
      initialState.signatures[0],
      initialState.signatures[1],
      channel.multisigAddress,
    );

    return { appIdentityHash, withdrawTracker };
  }
}
