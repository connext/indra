import { Injectable } from "@nestjs/common";

import { AnonymizedOnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { PinoLogger } from "nestjs-pino";

@Injectable()
export class CollateralService {
  constructor(
    private readonly anonymizedOnchainTransactionRepository: AnonymizedOnchainTransactionRepository,
    private readonly log: PinoLogger,
  ) {
    this.log.setContext("CollateralService");
  }

  async getAnonymizedCollateralData(start: number, end: number = Date.now()): Promise<any> {
    throw new Error("Reimplement");
    // const [onchain, offchain] = await Promise.all([
    //   this.anonymizedOnchainTransactionRepository.findInTimeRange(start, end),
    //   this.anonymizedTransferRepository.findInTimeRange(start, end),
    // ]);
    // return { offchain, onchain };
  }
}
