import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { getAddress } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, SwapRateProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";

import { SwapRateService } from "./swapRate.service";

export class SwapRateMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly config: ConfigService,
    log: LoggerService,
    messaging: IMessagingService,
    private readonly swapRateService: SwapRateService,
  ) {
    super(log, messaging);
    this.log.setContext("SwapRateMessaging");
  }

  async getLatestSwapRate(subject: string): Promise<string> {
    const from = subject.split(".")[1];
    const to = subject.split(".")[2];
    return this.swapRateService.getOrFetchRate(getAddress(from), getAddress(to));
  }

  async setupSubscriptions(): Promise<void> {
    super.connectRequestReponse(`swap-rate.>`, this.getLatestSwapRate.bind(this));
  }
}

export const swapRateProviderFactory: FactoryProvider<Promise<IMessagingService>> = {
  inject: [ConfigService, LoggerService, MessagingProviderId, SwapRateService],
  provide: SwapRateProviderId,
  useFactory: async (
    config: ConfigService,
    log: LoggerService,
    messaging: IMessagingService,
    swapRateService: SwapRateService,
  ): Promise<IMessagingService> => {
    const swapRate = new SwapRateMessaging(config, log, messaging, swapRateService);
    await swapRate.setupSubscriptions();
    return messaging;
  },
};
