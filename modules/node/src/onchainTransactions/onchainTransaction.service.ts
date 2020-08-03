import { MinimalTransaction, TransactionReceipt, StateChannelJSON } from "@connext/types";
import { stringify } from "@connext/utils";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { providers } from "ethers";
import PriorityQueue from "p-queue";

import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransaction, TransactionReason } from "./onchainTransaction.entity";
import { ChannelRepository } from "../channel/channel.repository";

const BAD_NONCE = "the tx doesn't have the correct nonce";
const NO_TX_HASH = "no transaction hash found in tx response";
const UNDERPRICED_REPLACEMENT = "replacement transaction underpriced";
export const MAX_RETRIES = 5;
export const KNOWN_ERRORS = [BAD_NONCE, NO_TX_HASH, UNDERPRICED_REPLACEMENT];

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

  async sendUserWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<providers.TransactionResponse> {
    return new Promise((resolve, reject) => {
      this.queues.get(channel.chainId).add(() => {
        this.sendTransaction(transaction, TransactionReason.USER_WITHDRAWAL, channel)
          .then((result) => resolve(result))
          .catch((error) => reject(error.message));
      });
    });
  }

  async sendWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<providers.TransactionResponse> {
    return new Promise((resolve, reject) => {
      this.queues.get(channel.chainId).add(() => {
        this.sendTransaction(transaction, TransactionReason.NODE_WITHDRAWAL, channel)
          .then((result) => resolve(result))
          .catch((error) => reject(error.message));
      });
    });
  }

  async sendDeposit(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<providers.TransactionResponse> {
    return new Promise((resolve, reject) => {
      this.queues.get(channel.chainId).add(() => {
        this.sendTransaction(transaction, TransactionReason.COLLATERALIZATION, channel)
          .then((result) => resolve(result))
          .catch((error) => reject(error.message));
      });
    });
  }

  findByHash(hash: string): Promise<OnchainTransaction | undefined> {
    return this.onchainTransactionRepository.findByHash(hash);
  }

  async sendMultisigDeployment(
    transaction: MinimalTransaction,
    json: StateChannelJSON,
  ): Promise<TransactionReceipt> {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(json.multisigAddress);
    await this.queues
      .get(channel.chainId)
      .add(() => this.sendTransaction(transaction, TransactionReason.MULTISIG_DEPLOY, channel));
    const tx = await this.onchainTransactionRepository.findLatestTransactionToChannel(
      channel.multisigAddress,
      TransactionReason.MULTISIG_DEPLOY,
    );
    return {
      to: tx.to,
      from: tx.from,
      gasUsed: tx.gasUsed,
      logsBloom: tx.logsBloom,
      blockHash: tx.blockHash,
      transactionHash: tx.hash,
      blockNumber: tx.blockNumber,
    } as TransactionReceipt;
  }

  private async sendTransaction(
    transaction: MinimalTransaction,
    reason: TransactionReason,
    channel: Channel,
  ): Promise<providers.TransactionResponse> {
    const wallet = this.configService.getSigner(channel.chainId);
    this.log.info(
      `sendTransaction: Using provider URL ${
        (wallet.provider as providers.JsonRpcProvider)?.connection?.url
      } on chain ${channel.chainId}`,
    );
    const errors: { [k: number]: string } = [];
    let tx: providers.TransactionResponse;
    for (let attempt = 1; attempt < MAX_RETRIES + 1; attempt += 1) {
      try {
        this.log.info(`Attempt ${attempt}/${MAX_RETRIES} to send transaction to ${transaction.to}`);
        const chainNonce = await wallet.getTransactionCount();
        const memoryNonce = await this.nonces.get(channel.chainId);
        const nonce = chainNonce > memoryNonce ? chainNonce : memoryNonce;
        const req = await wallet.populateTransaction({ ...transaction, nonce });
        tx = await wallet.sendTransaction(req);
        if (!tx.hash) {
          throw new Error(NO_TX_HASH);
        }
        // add fields from tx response
        await this.onchainTransactionRepository.addResponse(tx, reason, channel);
        this.nonces.set(channel.chainId, Promise.resolve(nonce + 1));
        tx.wait().then(async (receipt) => {
          this.log.info(
            `Success sending transaction! Tx mined at block ${receipt.blockNumber} on chain ${channel.chainId}: ${receipt.transactionHash}`,
          );
          await this.onchainTransactionRepository.addReceipt(receipt);
        });
        return tx;
      } catch (e) {
        errors[attempt] = e.message;
        const knownErr = KNOWN_ERRORS.find((err) => e.message.includes(err));
        if (!knownErr) {
          this.log.error(`Transaction failed to send with unknown error: ${e.message}`);
          throw new Error(e.stack || e.message);
        }
        // known error, retry
        this.log.warn(
          `Sending transaction attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}. Retrying.`,
        );
      }
    }
    await this.onchainTransactionRepository.markFailed(tx, errors);
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
