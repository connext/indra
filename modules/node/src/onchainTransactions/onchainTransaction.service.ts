import { MinimalTransaction, Contract } from "@connext/types";
import { Injectable } from "@nestjs/common";
import { TransactionResponse } from "ethers/providers";
import { AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";

@Injectable()
export class OnchainTransactionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
  ) {}

  async sendWithdrawalCommitment(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.configService.getEthWallet().sendTransaction(transaction);
    await this.onchainTransactionRepository.addReclaim(tx, channel);
    return tx;
  }

  async sendWithdrawal(
    channel: Channel,
    transaction: MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.configService.getEthWallet().sendTransaction(transaction);
    await this.onchainTransactionRepository.addWithdrawal(tx, channel);
    return tx;
  }

  async sendDeposit(
    channel: Channel,
    transaction: MinimalTransaction,
    assetId: string,
  ): Promise<TransactionResponse> {
    let tx;
    if (assetId == AddressZero) {
      tx = await this.configService.getEthWallet().sendTransaction(transaction);
    } else {
      const token = new Contract(assetId!, tokenAbi, this.configService.getEthProvider());
      tx = await token.functions.transfer(transaction.to, transaction.value);
    }
    await this.onchainTransactionRepository.addCollateralization(tx, channel);
    return tx
  }
}
