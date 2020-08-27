import { MinimalTransaction, TransactionReceipt } from "@connext/types";
import { getGasPrice, stringify } from "@connext/utils";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { providers, BigNumber } from "ethers";
import PriorityQueue from "p-queue";

import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransaction, TransactionReason } from "./onchainTransaction.entity";
import { ChannelRepository } from "../channel/channel.repository";

const MIN_GAS_LIMIT = BigNumber.from(500_000);
const BAD_NONCE = "the tx doesn't have the correct nonce";
const INVALID_NONCE = "Invalid nonce";
const NO_TX_HASH = "no transaction hash found in tx response";
const UNDERPRICED_REPLACEMENT = "replacement transaction underpriced";
export const MAX_RETRIES = 5;
export const KNOWN_ERRORS = [BAD_NONCE, NO_TX_HASH, UNDERPRICED_REPLACEMENT, INVALID_NONCE];

export type OnchainTransactionResponse = providers.TransactionResponse & {
  completed: (confirmations?: number) => Promise<void>; // resolved when tx is properly mined + stored
};

@Injectable()
export class OnchainTransactionService implements OnModuleInit {
  private nonces: Map<number, Promise<number>> = new Map();
  private queues: Map<number, PriorityQueue> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("OnchainTransactionService");
    this.configService.signers.forEach((signer, chainId) => {
      this.nonces.set(chainId, signer.getTransactionCount());
      this.queues.set(chainId, new PriorityQueue({ concurrency: 1 }));
    });
  }

  async findByAppId(appIdentityHash: string): Promise<OnchainTransaction | undefined> {
    return this.onchainTransactionRepository.findByAppId(appIdentityHash);
  }

  async sendUserWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
    appIdentityHash: string,
  ): Promise<OnchainTransactionResponse> {
    return this.queues.get(channel.chainId)!.add(
      () =>
        new Promise((resolve, reject) =>
          this.sendTransaction(
            transaction,
            TransactionReason.USER_WITHDRAWAL,
            channel,
            appIdentityHash,
          )
            .then((result) => resolve(result))
            .catch((error) => reject(error.message)),
        ),
    );
  }

  async sendWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
    appIdentityHash: string,
  ): Promise<OnchainTransactionResponse> {
    return this.queues.get(channel.chainId)!.add(
      () =>
        new Promise((resolve, reject) =>
          this.sendTransaction(
            transaction,
            TransactionReason.NODE_WITHDRAWAL,
            channel,
            appIdentityHash,
          )
            .then((result) => resolve(result))
            .catch((error) => reject(error.message)),
        ),
    );
  }

  async sendDeposit(
    channel: Channel,
    transaction: MinimalTransaction,
    appIdentityHash: string,
  ): Promise<OnchainTransactionResponse> {
    return this.queues.get(channel.chainId)!.add(
      () =>
        new Promise((resolve, reject) =>
          this.sendTransaction(
            transaction,
            TransactionReason.COLLATERALIZATION,
            channel,
            appIdentityHash,
          )
            .then((result) => resolve(result))
            .catch((error) => reject(error.message)),
        ),
    );
  }

  findByHash(hash: string): Promise<OnchainTransaction | undefined> {
    return this.onchainTransactionRepository.findByHash(hash);
  }

  setAppUninstalled(wasUninstalled: boolean, hash: string): Promise<void> {
    return this.onchainTransactionRepository.addAppUninstallFlag(wasUninstalled, hash);
  }

  async sendMultisigDeployment(
    transaction: MinimalTransaction,
    chainId: number,
    multisigAddress: string,
  ): Promise<providers.TransactionResponse> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    const tx: OnchainTransactionResponse = await new Promise((resolve, reject) => {
      this.queues.get(chainId)!.add(() => {
        this.sendTransaction(transaction, TransactionReason.MULTISIG_DEPLOY, channel)
          .then((result) => resolve(result))
          .catch((error) => reject(error.message));
      });
    });
    // make sure the wait function of the response includes the database
    // updates required to truly mark the transaction as completed
    const wait: Promise<TransactionReceipt> = new Promise(async (resolve, reject) => {
      try {
        const receipt = await tx.wait();
        await this.onchainTransactionRepository.addReceipt(receipt);
        resolve(receipt);
      } catch (e) {
        reject(e);
      }
    });
    return { ...tx, wait: () => wait };
  }

  async sendDisputeTransaction(
    transaction: MinimalTransaction,
    chainId: number,
    multisigAddress: string,
  ): Promise<providers.TransactionResponse> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    const queue = this.queues.get(chainId);
    if (!queue) {
      throw new Error(`Unsupported chainId ${chainId}. Expected one of: ${Array.from(this.queues.keys())}`);
    }
    const tx: OnchainTransactionResponse = await new Promise((resolve, reject) => {
      queue.add(() => {
        this.sendTransaction(transaction, TransactionReason.DISPUTE, channel)
          .then((result) => resolve(result))
          .catch((error) => reject(error.message));
      });
    });
    // make sure the wait function of the response includes the database
    // updates required to truly mark the transaction as completed
    const wait: Promise<TransactionReceipt> = new Promise(async (resolve, reject) => {
      try {
        const receipt = await tx.wait();
        await this.onchainTransactionRepository.addReceipt(receipt);
        resolve(receipt);
      } catch (e) {
        reject(e);
      }
    });
    return { ...tx, wait: () => wait };
  }

  private async sendTransaction(
    transaction: MinimalTransaction,
    reason: TransactionReason,
    channel: Channel,
    appIdentityHash?: string,
  ): Promise<OnchainTransactionResponse> {
    const wallet = this.configService.getSigner(channel.chainId);
    this.log.info(
      `sendTransaction: Using provider URL ${
        (wallet.provider as providers.JsonRpcProvider)?.connection?.url
      } on chain ${channel.chainId}`,
    );
    const errors: { [k: number]: string } = [];
    let tx: providers.TransactionResponse | undefined;
    let nonce: number | undefined;
    let attempt: number | undefined;
    for (attempt = 1; attempt < MAX_RETRIES + 1; attempt += 1) {
      try {
        this.log.info(`Attempt ${attempt}/${MAX_RETRIES} to send transaction to ${transaction.to}`);
        const chainNonce = await wallet.getTransactionCount();
        const memoryNonce = (await this.nonces.get(channel.chainId))!;
        nonce = chainNonce > memoryNonce ? chainNonce : memoryNonce;
        // add pending so we can mark it failed
        this.log.info(`Adding pending tx with nonce ${nonce}`);
        // TODO: (Med) Generate the transaction hash before sending

        // TODO: this wont work if the loop happens more than once
        // possible fix: add unique index on from+nonce and use onConflict
        // actually this wont work, easiest fix is to look it up by channel+reason+nonce first :/
        await this.onchainTransactionRepository.addPending(
          transaction,
          nonce,
          wallet.address,
          reason,
          channel,
          appIdentityHash,
        );
        this.log.info(`Populating tx with nonce ${nonce}`);
        const populatedTx = await wallet.populateTransaction({ ...transaction, nonce });
        this.log.info(`Sending tx with nonce ${nonce}`);
        tx = await wallet.sendTransaction({
          ...populatedTx,
          gasLimit: BigNumber.from(populatedTx.gasLimit || 0).lt(MIN_GAS_LIMIT)
            ? MIN_GAS_LIMIT
            : populatedTx.gasLimit,
          gasPrice: getGasPrice(wallet.provider!, channel.chainId),
        });
        this.log.info(`Tx submitted, hash: ${tx.hash}`);
        if (!tx.hash) {
          throw new Error(NO_TX_HASH);
        }
        this.nonces.set(channel.chainId, Promise.resolve(nonce + 1));
        // add fields from tx response
        await this.onchainTransactionRepository.addResponse(
          tx,
          nonce,
          reason,
          channel,
          appIdentityHash,
        );
        const start = Date.now();
        // eslint-disable-next-line no-loop-func
        const completed: Promise<void> = new Promise(async (resolve, reject) => {
          try {
            const receipt = await tx!.wait();
            this.log.info(`Tx mined, hash: ${receipt.transactionHash}`);
            await this.onchainTransactionRepository.addReceipt(receipt);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        tx.wait().then(async (receipt) => {
          this.log.info(
            `Success sending transaction! Tx mined at block ${receipt.blockNumber} on chain ${
              channel.chainId
            }: ${receipt.transactionHash} in ${Date.now() - start}ms`,
          );
          await this.onchainTransactionRepository.addReceipt(receipt);
          this.log.debug(`added receipt, status should be success`);
        });

        return { ...tx, completed: () => completed };
      } catch (e) {
        errors[attempt] = e.message;
        const knownErr = KNOWN_ERRORS.find((err) => e.message.includes(err));
        if (!knownErr) {
          this.log.error(`Transaction failed to send with unknown error: ${e.message}`);
          break;
        }
        // known error, retry
        this.log.warn(
          `Sending transaction attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}. Retrying.`,
        );
      }
    }
    if (tx) {
      this.log.info(`Marking failed by tx hash`);
      await this.onchainTransactionRepository.markFailedByTxHash(tx, errors, appIdentityHash);
    } else if (nonce) {
      this.log.info(`Marking failed by nonce`);
      await this.onchainTransactionRepository.markFailedByChannelFromAndNonce(
        channel.multisigAddress,
        wallet.address,
        nonce,
        errors,
        appIdentityHash,
      );
    } else {
      this.log.error(`No nonce or tx hash found to mark failed tx with!`);
    }
    throw new Error(`Failed to send transaction (errors indexed by attempt): ${stringify(errors)}`);
  }

  private retryFailedTransactions = async (): Promise<void> => {
    this.log.info(`retryFailedTransactions started`);
    const toResend = await this.onchainTransactionRepository.findFailedTransactions(KNOWN_ERRORS);
    // NOTE: could alternatively look only for withdrawals that are
    // finalized but have no onchain tx id. however, no reason not to retry
    // all failed txs
    this.log.info(`Found ${toResend.length} transactions to resend`);
    for (const stored of toResend) {
      try {
        await this.sendTransaction(
          { to: stored.to, value: stored.value, data: stored.data },
          stored.reason,
          stored.channel,
        );
      } catch (e) {
        this.log.warn(
          `Failed to send transaction, will retry on next startup, hash: ${stored.hash}. ${e.message}`,
        );
      }
    }
    this.log.info(`retryFailedTransactions completed`);
  };

  async onModuleInit(): Promise<void> {
    await this.retryFailedTransactions();
  }
}
