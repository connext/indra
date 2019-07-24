import { IMessagingService } from "@connext/messaging";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { Contract, ethers } from "ethers";
import { AddressZero } from "ethers/constants";
import { bigNumberify, formatEther, parseEther } from "ethers/utils";
import interval from "interval-promise";

import { medianizerAbi } from "../abi/medianizer.abi";
import { ConfigService } from "../config/config.service";
import { MessagingProviderId, SwapRateProviderId } from "../constants";
import { CLogger } from "../util";
import { AbstractMessagingProvider } from "../util/messaging";

const logger = new CLogger("ChannelService");
const MEDIANIZER_ADDRESS = "0x729D19f657BD0614b4985Cf1D82531c67569197B";

export class SwapRateMessaging extends AbstractMessagingProvider {
  private medianizer: Contract;
  private latestSwapRate: string;

  constructor(private readonly config: ConfigService, public messaging: IMessagingService) {
    super(messaging);
    const provider = ethers.getDefaultProvider();
    this.medianizer = new ethers.Contract(MEDIANIZER_ADDRESS, medianizerAbi, provider);
    provider.on("block", this.getSwapRate.bind(this)); // Check rate at each new block
  }

  async getSwapRate(): Promise<string> {
    const oldRate = this.latestSwapRate;
    try {
      this.latestSwapRate = formatEther((await this.medianizer.peek())[0]);
      logger.debug(`Got swap rate from medianizer: ${this.latestSwapRate}`);
    } catch (e) {
      logger.warn(`Failed to fetch swap rate from medianizer`);
      if (process.env.NODE_ENV === "development" && !this.latestSwapRate) {
        this.latestSwapRate = "1";
        logger.log(`Dev-mode: using hard coded swap rate: ${this.latestSwapRate}`);
      }
    }
    if (oldRate !== this.latestSwapRate) {
      this.broadcastRate(); // Only broadcast the rate if it's changed
    }
    return this.latestSwapRate;
  }

  async getLatestSwapRate(from: string, to: string): Promise<any> {
    return this.latestSwapRate || (await this.getSwapRate());
  }

  async broadcastRate(): Promise<void> {
    const swapRate = await this.getSwapRate();
    const tokenAddress = await this.config.getTokenAddress();
    this.messaging.publish(`swap-rate.${AddressZero}.${tokenAddress}`, { swapRate });
  }

  async setupSubscriptions(): Promise<void> {
    const tokenAddress = await this.config.getTokenAddress();
    super.connectRequestReponse(
      `swap-rate.${AddressZero}.${tokenAddress}`,
      this.getLatestSwapRate.bind(this),
    );
  }
}

export const swapRateProviderFactory: FactoryProvider<Promise<IMessagingService>> = {
  inject: [MessagingProviderId, ConfigService],
  provide: SwapRateProviderId,
  useFactory: async (
    messaging: IMessagingService,
    config: ConfigService,
  ): Promise<IMessagingService> => {
    const swapRate = new SwapRateMessaging(config, messaging);
    await swapRate.setupSubscriptions();
    return messaging;
  },
};
