import { IMessagingService } from "@connext/messaging";
import { AllowedSwap, PriceOracleType, SwapRate } from "@connext/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { getMarketDetails, getTokenReserves } from "@uniswap/sdk";
import { Contract, ethers } from "ethers";
import { AddressZero } from "ethers/constants";

import { ConfigService } from "../config/config.service";
import { MessagingProviderId } from "../constants";
import { CLogger } from "../util";
import { parseEther } from "ethers/utils";

const logger = new CLogger("SwapService");

@Injectable()
export class SwapRateService implements OnModuleInit {
  private medianizer: Contract;
  private latestSwapRates: SwapRate[] = [];

  constructor(
    private readonly config: ConfigService,
    @Inject(MessagingProviderId) private readonly messaging: IMessagingService,
  ) {}

  async getOrFetchRate(from: string, to: string): Promise<string> {
    const swap = this.latestSwapRates.find((s: SwapRate) => s.from === from && s.to === to);
    let rate: string;
    if (swap) {
      rate = swap.rate;
    } else {
      rate = await this.getSwapRate(from, to, swap.priceOracleType);
    }
    return rate;
  }

  async getSwapRate(
    from: string,
    to: string,
    priceOracleType: PriceOracleType,
    blockNumber: number = 0,
  ): Promise<string | undefined> {
    if (!this.config.getAllowedSwaps().find((s: AllowedSwap) => s.from === from && s.to === to)) {
      throw new Error(`No valid swap exists for ${from} to ${to}`);
    }
    const rateIndex = this.latestSwapRates.findIndex((s: SwapRate) => s.from === from && s.to === to);
    let oldRate: string | undefined;
    if (rateIndex !== -1) {
      oldRate = this.latestSwapRates[rateIndex].rate;
    }

    if (this.latestSwapRates[rateIndex] && this.latestSwapRates[rateIndex].blockNumber === blockNumber) {
      // already have rates for this block
      return undefined;
    }

    // check rate based on configured price oracle
    let newRate: string;
    try {
      switch (priceOracleType) {
        case "UNISWAP":
          newRate = await this.getUniswapRate(from, to);
          break;
        default:
          throw new Error(`Price oracle not configured for swap ${from} -> ${to}`);
      }
    } catch (e) {
      logger.warn(`Failed to fetch swap rate from ${priceOracleType}`);
      if (process.env.NODE_ENV === "development") {
        newRate = await this.config.getDefaultSwapRate(from, to);
        if (!newRate) {
          throw e;
        }
      }
    }

    // eslint-disable-next-line sort-keys
    const newSwap: SwapRate = { from, to, rate: newRate, priceOracleType, blockNumber };
    if (rateIndex !== -1) {
      oldRate = this.latestSwapRates[rateIndex].rate;
      this.latestSwapRates[rateIndex] = newSwap;
    } else {
      this.latestSwapRates.push(newSwap);
    }
    const oldRateBn = parseEther(oldRate || "0");
    const newRateBn = parseEther(newRate);
    if (!oldRateBn.eq(newRateBn)) {
      logger.log(`Got swap rate from Uniswap at block ${blockNumber}: ${newRate}`);
      this.broadcastRate(from, to); // Only broadcast the rate if it's changed
    }
    return newRate;
  }

  async getUniswapRate(from: string, to: string): Promise<string> {
    let fromReserves = undefined;
    if (from !== AddressZero) {
      const fromMainnetAddress = await this.config.getTokenAddressForSwap(from);
      fromReserves = await getTokenReserves(fromMainnetAddress);
    }

    let toReserves = undefined;
    if (to !== AddressZero) {
      const toMainnetAddress = await this.config.getTokenAddressForSwap(to);
      toReserves = await getTokenReserves(toMainnetAddress);
    }

    const marketDetails = getMarketDetails(fromReserves, toReserves);

    const newRate = marketDetails.marketRate.rate.toString();
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
    const swaps = this.config.getAllowedSwaps();

    for (const swap of swaps) {
      // Check rate at each new block
      provider.on("block", (blockNumber: number) =>
        this.getSwapRate(swap.from, swap.to, swap.priceOracleType, blockNumber),
      );
    }
  }
}
