import { MessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { getAddress } from "ethers/utils";

import { LoggerService } from "../logger/logger.service";
import { ConfigService } from "../config/config.service";
import { MessagingProviderId, SwapRateProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";

import { SwapRateService } from "./swapRate.service";

export class SwapRateMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly configService: ConfigService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly swapRateService: SwapRateService,
  ) {
    super(log, messaging);
    this.log.setContext("SwapRateMessaging");
  }

  async getLatestSwapRate(subject: string): Promise<string> {
    const [node, user, messageSubject, from, to] = subject.split(".");
    return this.swapRateService.getOrFetchRate(getAddress(from), getAddress(to));
  }

  async setupSubscriptions(): Promise<void> {
    const publicIdentifier = this.configService.getPublicIdentifier();
    await super.connectRequestReponse(
      `${publicIdentifier}.*.swap-rate.>`, this.getLatestSwapRate.bind(this));
  }
}

export const swapRateProviderFactory: FactoryProvider<Promise<MessagingService>> = {
  inject: [ConfigService, LoggerService, MessagingProviderId, SwapRateService],
  provide: SwapRateProviderId,
  useFactory: async (
    configService: ConfigService,
    log: LoggerService,
    messaging: MessagingService,
    swapRateService: SwapRateService,
  ): Promise<MessagingService> => {
    const swapRate = new SwapRateMessaging(configService, log, messaging, swapRateService);
    await swapRate.setupSubscriptions();
    return messaging;
  },
};
