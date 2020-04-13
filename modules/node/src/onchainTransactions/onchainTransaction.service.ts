import { MinimalTransaction, stringify } from "@connext/types";
import { Injectable } from "@nestjs/common";
import { TransactionResponse } from "ethers/providers";

import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";
import { LoggerService } from "../logger/logger.service";

const NO_TX_HASH = "no transaction hash found in tx response";
export const MAX_RETRIES = 3;
export const KNOWN_ERRORS = [
  "the tx doesn't have the correct nonce",
  NO_TX_HASH,
];

@Injectable()
export class OnchainTransactionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("OnchainTransactionService");
  }

  async sendWithdrawalCommitment(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.sendTransaction(transaction);
    await this.onchainTransactionRepository.addReclaim(tx, channel);
    return tx;
  }

  async sendWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.sendTransaction(transaction);
    await this.onchainTransactionRepository.addWithdrawal(tx, channel);
    return tx;
  }

  async sendDeposit(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.sendTransaction(transaction);
    await this.onchainTransactionRepository.addCollateralization(tx, channel);
    return tx;
  }

  private async sendTransaction(
    transaction: MinimalTransaction,
  ): Promise<TransactionResponse> {
    const wallet = this.configService.getSigner();
    let errors: {[k: number]: string} = [];
    for (let attempt = 1; attempt < MAX_RETRIES + 1; attempt += 1) {
      try {
        this.log.info(`Attempt ${attempt}/${MAX_RETRIES} to send transaction to ${transaction.to}`);
        const tx = await wallet.sendTransaction({ 
          ...transaction,
          nonce: await wallet.provider.getTransactionCount(await wallet.getAddress()),
        });
        if (!tx.hash) {
          throw new Error(NO_TX_HASH);
        }
        this.log.debug(`Success! Tx hash: ${tx.hash}`);
        return tx;
      } catch (e) {
        errors[attempt] = e.message;
        const knownErr = KNOWN_ERRORS.filter(err => e.message.includes(err))[0];
        if (!knownErr) {
          this.log.error(`Transaction failed to send with unknown error: ${e.message}`);
          throw new Error(e.stack || e.message);
        }
        // known error, retry
        this.log.warn(`Sending transaction attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}. Retrying.`);
      }
    }
    throw new Error(`Failed to send transaction (errors indexed by attempt): ${stringify(errors, 2)}`);
  }
}
