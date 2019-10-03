import { IMessagingService } from "@connext/messaging";
import { AllowedSwap, SwapRate } from "@connext/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Contract, ethers } from "ethers";
import { AddressZero } from "ethers/constants";
import { formatEther, getAddress } from "ethers/utils";

import { medianizerAbi } from "../abi/medianizer.abi";
import { ConfigService } from "../config/config.service";
import { MessagingProviderId } from "../constants";
import { CLogger } from "../util";

const MEDIANIZER_ADDRESS = "0x729D19f657BD0614b4985Cf1D82531c67569197B";

const logger = new CLogger("SwapService");

@Injectable()
export class SwapRateService implements OnModuleInit {
  private medianizer: Contract;
  private latestSwapRates: SwapRate[] = [];

  constructor(
    private readonly config: ConfigService,
    @Inject(MessagingProviderId) private readonly messaging: IMessagingService,
  ) {}

  async getValidSwaps(): Promise<AllowedSwap[]> {
    const allowedSwaps: AllowedSwap[] = [
      {
        from: await this.config.getTokenAddress(),
        to: AddressZero,
      },
      {
        from: AddressZero,
        to: await this.config.getTokenAddress(),
      },
    ];
    return allowedSwaps;
  }

  async getOrFetchRate(from: string, to: string): Promise<string> {
    const swap = this.latestSwapRates.find((s: SwapRate) => s.from === from && s.to === to);
    let rate: string;
    if (swap) {
      rate = swap.rate;
    } else {
      rate = await this.getSwapRate(from, to);
    }
    return rate;
  }

  async getSwapRate(from: string, to: string, blockNumber: number = 0): Promise<string> {
    if (!(await this.getValidSwaps()).find((s: AllowedSwap) => s.from === from && s.to === to)) {
      throw new Error(`No valid swap exists for ${from} to ${to}`);
    }
    const rateIndex = this.latestSwapRates.findIndex(
      (s: SwapRate) => s.from === from && s.to === to,
    );
    let oldRate: string | undefined;
    if (rateIndex !== -1) {
      oldRate = this.latestSwapRates[rateIndex].rate;
    }
    const tokenAddress = await this.config.getTokenAddress();

    let newRate: string;
    if (from === AddressZero && to === tokenAddress) {
      try {
        const bnRate = (await this.medianizer.peek())[0];
        newRate = formatEther(bnRate);
      } catch (e) {
        logger.warn(`Failed to fetch swap rate from medianizer`);
        logger.warn(e);
        if (process.env.NODE_ENV === "development" && !oldRate) {
          newRate = "100";
          logger.log(`Dev-mode: using hard coded swap rate: ${newRate.toString()}`);
        }
      }
    } else if (from === tokenAddress && to === AddressZero) {
      try {
        newRate = (1 / parseFloat(formatEther((await this.medianizer.peek())[0]))).toString();
      } catch (e) {
        logger.warn(`Failed to fetch swap rate from medianizer`);
        logger.warn(e);
        if (process.env.NODE_ENV === "development" && !oldRate) {
          newRate = ".005";
          logger.log(`Dev-mode: using hard coded swap rate: ${newRate.toString()}`);
        }
      }
    }

    const newSwap: SwapRate = { from, to, rate: newRate };
    if (rateIndex !== -1) {
      this.latestSwapRates[rateIndex] = newSwap;
    } else {
      this.latestSwapRates.push(newSwap);
    }
    if (oldRate !== newRate) {
      logger.log(`Got swap rate from medianizer at block ${blockNumber}: ${newRate}`);
      this.broadcastRate(from, to); // Only broadcast the rate if it's changed
    }
    return newRate;
  }

  async broadcastRate(from: string, to: string): Promise<void> {
    const swap = this.latestSwapRates.find((s: SwapRate) => s.from === from && s.to === to);
    if (!swap) {
      throw new Error(`No rate exists for ${from} to ${to}`);
    }
    this.messaging.publish(`swap-rate.${from}.${to}`, {
      swapRate: swap.rate,
    });
  }

  async onModuleInit(): Promise<void> {
    const provider = ethers.getDefaultProvider();
    this.medianizer = new ethers.Contract(MEDIANIZER_ADDRESS, medianizerAbi, provider);
    const swaps = await this.getValidSwaps();
    for (const swap of swaps) {
      // Check rate at each new block
      provider.on("block", (blockNumber: number) =>
        this.getSwapRate(swap.from, swap.to, blockNumber),
      );
    }
  }
}
