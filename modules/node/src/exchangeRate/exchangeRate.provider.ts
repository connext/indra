import { FactoryProvider } from "@nestjs/common/interfaces";
import interval from "interval-promise";

import { ExchangeRateProviderId } from "../constants";

import { ExchangeRateService } from "./exchangeRate.service";

export const exchangeRateProvider: FactoryProvider = {
  inject: [ExchangeRateService],
  provide: ExchangeRateProviderId,
  useFactory: (exchangeRateService: ExchangeRateService): void => {
    interval(async () => {
      await exchangeRateService.publishRate();
    }, 5000);
  },
};
