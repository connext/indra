import { MinimalTransaction } from "@connext/types";
import { stringify } from "@connext/utils";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { providers } from "ethers";
import PriorityQueue from "p-queue";

import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransaction, TransactionReason } from "./onchainTransaction.entity";

const BAD_NONCE = "the tx doesn't have the correct nonce";
const NO_TX_HASH = "no transaction hash found in tx response";
export const MAX_RETRIES = 5;
export const KNOWN_ERRORS = [BAD_NONCE, NO_TX_HASH];

@Injectable()
export class OnchainTransactionService implements OnModuleInit {
  private nonce = Promise.resolve(0);
  private readonly queue: PriorityQueue;

  constructor(
    private readonly configService: ConfigService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("OnchainTransactionService");
    this.nonce = this.configService.getSigner().getTransactionCount();
    this.queue = new PriorityQueue({ concurrency: 1 });
  }

  async sendUserWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<OnchainTransaction> {
    await this.queue.add(() =>
      this.sendTransaction(transaction, TransactionReason.USER_WITHDRAWAL, channel),
    );
    return this.onchainTransactionRepository.findLatestTransactionToChannel(
      channel.multisigAddress,
      TransactionReason.USER_WITHDRAWAL,
    );
  }

  async sendWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<OnchainTransaction> {
    await this.queue.add(() =>
      this.sendTransaction(transaction, TransactionReason.NODE_WITHDRAWAL, channel),
    );
    return this.onchainTransactionRepository.findLatestTransactionToChannel(
      channel.multisigAddress,
      TransactionReason.NODE_WITHDRAWAL,
    );
  }

  async sendDeposit(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<OnchainTransaction> {
    await this.queue.add(() =>
      this.sendTransaction(transaction, TransactionReason.COLLATERALIZATION, channel),
    );
    return this.onchainTransactionRepository.findLatestTransactionToChannel(
      channel.multisigAddress,
      TransactionReason.COLLATERALIZATION,
    );
  }

  findByHash(hash: string): Promise<OnchainTransaction | undefined> {
    return this.onchainTransactionRepository.findByHash(hash);
  }

  private async sendTransaction(
    transaction: MinimalTransaction,
    reason: TransactionReason,
    channel: Channel,
  ): Promise<void> {
    const wallet = this.configService.getSigner();
    const errors: { [k: number]: string } = [];
    let tx: providers.TransactionResponse;
    for (let attempt = 1; attempt < MAX_RETRIES + 1; attempt += 1) {
      try {
        this.log.info(`Attempt ${attempt}/${MAX_RETRIES} to send transaction to ${transaction.to}`);
        const chainNonce = await wallet.getTransactionCount();
        const memoryNonce = await this.nonce;
        const nonce = chainNonce > memoryNonce ? chainNonce : memoryNonce;
        const req = await wallet.populateTransaction({ ...transaction, nonce });
        tx = await wallet.sendTransaction(req);
        // add fields from tx response
        await this.onchainTransactionRepository.addResponse(tx, reason, channel);
        this.nonce = Promise.resolve(nonce + 1);
        const receipt = await tx.wait();
        if (!tx.hash) {
          throw new Error(NO_TX_HASH);
        }
        this.log.info(
          `Success sending transaction! Tx mined at block ${receipt.blockNumber}: ${receipt.transactionHash}`,
        );
        await this.onchainTransactionRepository.addReceipt(receipt);
        return;
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
