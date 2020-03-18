import { CFCoreTypes } from "@connext/types";
import { Injectable } from "@nestjs/common";
import { TransactionResponse } from "ethers/providers";

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
    transaction: CFCoreTypes.MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.configService.getEthWallet().sendTransaction(transaction);
    await this.onchainTransactionRepository.addReclaim(tx, channel);
    return tx;
  }

  async sendWithdrawal(
    channel: Channel,
    transaction: CFCoreTypes.MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.configService.getEthWallet().sendTransaction(transaction);
    await this.onchainTransactionRepository.addWithdrawal(tx, channel);
    return tx;
  }
}
