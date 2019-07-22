import { FactoryProvider } from "@nestjs/common/interfaces";
import interval from "interval-promise";

import { SwapRateProviderId } from "../constants";

import { SwapRateService } from "./swapRate.service"

export const swapRateProvider: FactoryProvider = {
  inject: [SwapRateService],
  provide: SwapRateProviderId,
  useFactory: (swapRateService: SwapRateService): void => {
    interval(async () => {
      await swapRateService.publishRate();
    }, 5000);
  },
};
