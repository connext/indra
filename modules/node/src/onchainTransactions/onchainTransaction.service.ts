import { CFCoreTypes } from "@connext/types";
import { Injectable } from "@nestjs/common";
import { Wallet } from "ethers";
import { JsonRpcProvider, TransactionResponse } from "ethers/providers";

import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";

import { OnchainTransactionRepository } from "./onchainTransaction.repository";

@Injectable()
export class OnchainTransactionService {
  ethProvider: JsonRpcProvider;
  wallet: Wallet;

  constructor(
    private readonly configService: ConfigService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
  ) {
    this.ethProvider = this.configService.getEthProvider();
    this.wallet = this.configService.getEthWallet();
  }

  async sendWithdrawalCommitment(
    channel: Channel,
    transaction: CFCoreTypes.MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.wallet.sendTransaction(transaction);
    await this.onchainTransactionRepository.addReclaim(tx, channel);
    return tx;
  }

  async sendUserWithdrawal(
    channel: Channel,
    transaction: CFCoreTypes.MinimalTransaction,
  ): Promise<TransactionResponse> {
    const tx = await this.wallet.sendTransaction(transaction);
    await this.onchainTransactionRepository.addUserWithdrawal(tx, channel);
    return tx;
  }
}
