import { Controller, Get, Query } from "@nestjs/common";

import { AnonymizedTransfer } from "../transfer/transfer.entity";
import { AnonymizedOnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";

import { GetAnonymizedCollateralDataDto } from "./collateral.dto";
import { CollateralService } from "./collateral.service";

@Controller("collateral")
export class CollateralController {
  constructor(private readonly collateralService: CollateralService) {}

  @Get("anonymized")
  async getAnonymizedTransfers(
    @Query() query: GetAnonymizedCollateralDataDto,
  ): Promise<{ offchain: AnonymizedTransfer[]; onchain: AnonymizedOnchainTransaction[] }> {
    return await this.collateralService.getAnonymizedCollateralData(query.start, query.end);
  }
}
