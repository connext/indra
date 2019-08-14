import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { AddressZero } from "ethers/constants";
import { getAddress } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { MessagingProviderId, SwapRateProviderId } from "../constants";
import { AbstractMessagingProvider, CLogger } from "../util";

import { SwapRateService } from "./swapRate.service";

const logger = new CLogger("ChannelService");

export class SwapRateMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly swapRateService: SwapRateService,
    private readonly config: ConfigService,
    public messaging: IMessagingService,
  ) {
    super(messaging);
  }

  async getLatestSwapRate(subject: string): Promise<string> {
    const pieces = subject.split(".");
    const [subj, from, to] = pieces;
    return this.swapRateService.getOrFetchRate(getAddress(from), getAddress(to));
  }

  async setupSubscriptions(): Promise<void> {
    super.connectRequestReponse(`swap-rate.>`, this.getLatestSwapRate.bind(this));
  }
}

export const swapRateProviderFactory: FactoryProvider<Promise<IMessagingService>> = {
  inject: [MessagingProviderId, ConfigService, SwapRateService],
  provide: SwapRateProviderId,
  useFactory: async (
    messaging: IMessagingService,
    config: ConfigService,
    swapRateService: SwapRateService,
  ): Promise<IMessagingService> => {
    const swapRate = new SwapRateMessaging(swapRateService, config, messaging);
    await swapRate.setupSubscriptions();
    return messaging;
  },
};
