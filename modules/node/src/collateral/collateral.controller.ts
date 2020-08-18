import { Controller, Get, Query } from "@nestjs/common";

import { GetAnonymizedCollateralDataDto } from "./collateral.dto";
import { CollateralService } from "./collateral.service";

@Controller("collateral")
export class CollateralController {
  constructor(private readonly collateralService: CollateralService) {}

  @Get("anonymized")
  async getAnonymizedTransfers(@Query() query: GetAnonymizedCollateralDataDto): Promise<any> {
    const start = query.start ? parseInt(query.start) : 0;
    const end = query.end ? parseInt(query.end) : undefined;
    return this.collateralService.getAnonymizedCollateralData(start, end);
  }
}
