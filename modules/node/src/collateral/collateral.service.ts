import { Injectable } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";
import { AnonymizedOnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { AnonymizedTransferRepository } from "../transfer/anonymizedTransfer.repository";

import { AnonymizedTransfer } from "../transfer/anonymizedTransfer.entity";
import { AnonymizedOnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";

@Injectable()
export class CollateralService {
  constructor(
    private readonly anonymizedOnchainTransactionRepository: AnonymizedOnchainTransactionRepository,
    private readonly anonymizedTransferRepository: AnonymizedTransferRepository,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("CollateralService");
  }

  async getAnonymizedCollateralData(
    start: number,
    end: number = Date.now(),
  ): Promise<{ offchain: AnonymizedTransfer[]; onchain: AnonymizedOnchainTransaction[] }> {
    const [onchain, offchain] = await Promise.all([
      this.anonymizedOnchainTransactionRepository.findInTimeRange(start, end),
      this.anonymizedTransferRepository.findInTimeRange(start, end),
    ]);

    return { offchain, onchain };
  }
}
