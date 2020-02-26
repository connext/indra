import { Injectable } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";
import { AnonymizedOnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { AnonymizedTransferRepository } from "../transfer/transfer.repository";

import { AnonymizedTransfer } from "src/transfer/transfer.entity";
import { AnonymizedOnchainTransaction } from "src/onchainTransactions/onchainTransaction.entity";

@Injectable()
export class CollateralService {
  constructor(
    private readonly anonymizedOnchainTransactionRepository: AnonymizedOnchainTransactionRepository,
    private readonly anonymizedTransferRepository: AnonymizedTransferRepository,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext("CollateralService");
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
