import { IMessagingService } from "@connext/messaging";
import { AllowedSwap, SwapRate } from "@connext/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { getMarketDetails, getTokenReserves } from "@uniswap/sdk";
import { Contract, ethers } from "ethers";
import { AddressZero } from "ethers/constants";
import { formatEther } from "ethers/utils";

import { medianizerAbi } from "../abi/medianizer.abi";
import { ConfigService } from "../config/config.service";
import { MessagingProviderId } from "../constants";
import { CLogger } from "../util";

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
      rate = await this.getSwapRate(from, to);
    }
    return rate;
  }

  async getSwapRate(from: string, to: string, blockNumber: number = 0): Promise<string | undefined> {
    if (!this.config.getAllowedSwaps().find((s: AllowedSwap) => s.from === from && s.to === to)) {
      throw new Error(`No valid swap exists for ${from} to ${to}`);
    }
    const rateIndex = this.latestSwapRates.findIndex((s: SwapRate) => s.from === from && s.to === to);

    const ethProvider = this.config.getEthProvider();
    const latestBlock = await ethProvider.getBlockNumber();
    if (this.latestSwapRates[rateIndex] && this.latestSwapRates[rateIndex].blockNumber === latestBlock) {
      // already have rates for this block
      return undefined;
    }

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
    console.log("marketDetails: ", marketDetails.marketRate.rate.toString());

    const newRate = formatEther(marketDetails.marketRate.rate.toString());
    // eslint-disable-next-line sort-keys
    const newSwap: SwapRate = { from, to, rate: newRate };
    let oldRate: string | undefined;
    if (rateIndex !== -1) {
      oldRate = this.latestSwapRates[rateIndex].rate;
      this.latestSwapRates[rateIndex] = newSwap;
    } else {
      this.latestSwapRates.push(newSwap);
    }
    if (oldRate !== newRate) {
      logger.log(`Got swap rate from Uniswap at block ${blockNumber}: ${newRate}`);
      this.broadcastRate(from, to); // Only broadcast the rate if it's changed
    }

    const inverseNewRate = formatEther(marketDetails.marketRate.rateInverted.toString());
    // eslint-disable-next-line sort-keys
    const inverseNewSwap: SwapRate = { from: to, to: from, rate: inverseNewRate };
    const inverseRateIndex = this.latestSwapRates.findIndex((s: SwapRate) => s.from === to && s.to === from);
    let inverseOldRate: string | undefined;
    if (inverseRateIndex !== -1) {
      inverseOldRate = this.latestSwapRates[inverseRateIndex].rate;
      this.latestSwapRates[rateIndex] = inverseNewSwap;
    } else {
      this.latestSwapRates.push(inverseNewSwap);
    }
    if (inverseOldRate !== inverseNewRate) {
      logger.log(`Got swap rate from Uniswap at block ${blockNumber}: ${inverseNewRate}`);
      this.broadcastRate(to, from); // Only broadcast the rate if it's changed
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
    const swaps = this.config.getAllowedSwaps();

    for (const swap of swaps) {
      // Check rate at each new block
      provider.on("block", (blockNumber: number) => this.getSwapRate(swap.from, swap.to, blockNumber));
    }
  }
}
