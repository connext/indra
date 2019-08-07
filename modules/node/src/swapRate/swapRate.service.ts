import { IMessagingService } from "@connext/messaging";
import { Inject, Injectable } from "@nestjs/common";
import { Contract, ethers } from "ethers";
import { AddressZero } from "ethers/constants";
import { bigNumberify, formatEther, parseEther } from "ethers/utils";

import { medianizerAbi } from "../abi/medianizer.abi";
import { ConfigService } from "../config/config.service";
import { MessagingProviderId } from "../constants";
import { CLogger } from "../util";

const MEDIANIZER_ADDRESS = "0x729D19f657BD0614b4985Cf1D82531c67569197B";

const logger = new CLogger("SwapService");

@Injectable()
export class SwapRateService {
  private medianizer: Contract;
  private latestSwapRate: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(MessagingProviderId) private readonly messaging: IMessagingService,
  ) {
    const provider = ethers.getDefaultProvider();
    this.medianizer = new ethers.Contract(MEDIANIZER_ADDRESS, medianizerAbi, provider);
    provider.on("block", this.getSwapRate.bind(this)); // Check rate at each new block
  }

  async getOrFetchRate(): Promise<string> {
    return this.latestSwapRate || (await this.getSwapRate());
  }

  async getSwapRate(blockNumber?: number): Promise<string> {
    const oldRate = this.latestSwapRate;
    try {
      this.latestSwapRate = bigNumberify((await this.medianizer.peek())[0]).toString();
    } catch (e) {
      logger.warn(`Failed to fetch swap rate from medianizer`);
      if (process.env.NODE_ENV === "development" && !this.latestSwapRate) {
        this.latestSwapRate = parseEther("200").toString();
        logger.log(`Dev-mode: using hard coded swap rate: ${this.latestSwapRate}`);
      }
    }
    if (oldRate !== this.latestSwapRate) {
      logger.log(
        `Got new swap rate from medianizer at block ${blockNumber}: ${formatEther(
          this.latestSwapRate,
        )}`,
      );
      this.broadcastRate(); // Only broadcast the rate if it's changed
    }
    return this.latestSwapRate;
  }

  async broadcastRate(): Promise<void> {
    const tokenAddress = await this.config.getTokenAddress();
    this.messaging.publish(`swap-rate.${AddressZero}.${tokenAddress}`, {
      swapRate: this.latestSwapRate,
    });
  }
}
