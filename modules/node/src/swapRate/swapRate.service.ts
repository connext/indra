import { MessagingService } from "@connext/messaging";
import {
  AllowedSwap,
  PriceOracleTypes,
  SwapRate,
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { getMarketDetails, getTokenReserves } from "@uniswap/sdk";
import { constants, utils } from "ethers";

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId } from "../constants";

const { AddressZero } = constants;
const { parseEther } = utils;

@Injectable()
export class SwapRateService implements OnModuleInit {
  private latestSwapRates: Map<number, SwapRate[]> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly log: LoggerService,
    @Inject(MessagingProviderId) private readonly messaging: MessagingService,
  ) {
    this.log.setContext("SwapRateService");
  }

  hardcodedDemoSwapRate(
    from: string,
    to: string,
    fromChainId: number,
    toChainId: number,
  ): string | undefined {
    const TOKEN_TO_ETH = "0.01";
    const ETH_TO_TOKEN = "0.01";
    const SAME_ASSET = "1";

    const fromIsConfigToken = from === this.config.getTokenAddress(fromChainId);
    const toIsConfigToken = to === this.config.getTokenAddress(toChainId);

    // rethink this before enabling mainnet
    if (fromChainId === 1 || toChainId === 1) {
      return undefined;
    }

    // TOKEN TO ETH = 0.01
    if (fromIsConfigToken && to === CONVENTION_FOR_ETH_ASSET_ID) {
      this.log.info(`Using hardcoded swap rate for token to ETH: ${TOKEN_TO_ETH}`);
      return TOKEN_TO_ETH;
    }

    // ETH TO TOKEN = 100
    if (from === CONVENTION_FOR_ETH_ASSET_ID && toIsConfigToken) {
      this.log.info(`Using hardcoded swap rate for ETH to token: ${ETH_TO_TOKEN}`);
      return "100";
    }

    // ETH TO ETH = 1
    if (from === CONVENTION_FOR_ETH_ASSET_ID && to === CONVENTION_FOR_ETH_ASSET_ID) {
      this.log.info(`Using hardcoded swap rate for same asset across chains: ${SAME_ASSET}`);
      return "1";
    }

    // TOKEN TO TOKEN = 1
    if (fromIsConfigToken && toIsConfigToken) {
      this.log.info(`Using hardcoded swap rate for same asset across chains: ${SAME_ASSET}`);
      return "1";
    }

    return undefined;
  }

  async getOrFetchRate(
    from: string,
    to: string,
    fromChainId: number,
    toChainId: number,
  ): Promise<string> {
    let rate: string | undefined;

    // HARDCODED RATES FOR DEMO
    rate = this.hardcodedDemoSwapRate(from, to, fromChainId, toChainId);
    if (rate) {
      return rate;
    }

    const latest = this.latestSwapRates.get(fromChainId);
    if (!latest) {
      throw new Error(`Could not get latest rates for chain id ${fromChainId}`);
    }
    const swap = latest.find((s: SwapRate) => s.from === from && s.to === to);
    if (swap) {
      rate = swap.rate;
    } else {
      this.log.debug(`Getting or fetching rate from chain ${fromChainId} to chain ${toChainId}`);
      const targetSwap = this.config
        .getAllowedSwaps(fromChainId)
        .find((s) => s.from === from && s.to === to);
      if (targetSwap) {
        rate = await this.fetchSwapRate(from, to, targetSwap.priceOracleType, fromChainId);
      } else {
        throw new Error(`No valid swap exists for ${from} to ${to}`);
      }
    }
    if (!rate) {
      throw new Error(`Could not get rate for ${from}:${fromChainId} to ${to}:${toChainId}`);
    }
    return rate;
  }

  async fetchSwapRate(
    from: string,
    to: string,
    priceOracleType: PriceOracleTypes,
    chainId: number,
    blockNumber: number = 0,
  ): Promise<string | undefined> {
    this.log.debug(`Fetching swap rate for chain ${chainId}`);
    if (
      !this.config.getAllowedSwaps(chainId).find((s: AllowedSwap) => s.from === from && s.to === to)
    ) {
      throw new Error(`No valid swap exists for ${from} to ${to}`);
    }
    const latestRate = this.latestSwapRates.get(chainId);
    const rateIndex = latestRate
      ? latestRate.findIndex((s: SwapRate) => s.from === from && s.to === to)
      : -1;
    let oldRate: string | undefined;
    if (rateIndex !== -1) {
      oldRate = this.latestSwapRates[rateIndex]?.rate;
    }

    if (
      this.latestSwapRates[rateIndex] &&
      this.latestSwapRates[rateIndex].blockNumber === blockNumber
    ) {
      // already have rates for this block
      return undefined;
    }

    // check rate based on configured price oracle
    let newRate: string | undefined;
    try {
      newRate = (await Promise.race([
        new Promise(
          async (resolve): Promise<void> => {
            switch (priceOracleType) {
              case PriceOracleTypes.UNISWAP:
                resolve(await this.getUniswapRate(from, to));
                break;
              case PriceOracleTypes.HARDCODED:
                resolve(await this.config.getHardcodedRate(from, to));
                break;
              default:
                throw new Error(`Price oracle not configured for swap ${from} -> ${to}`);
            }
          },
        ),
        new Promise((res: any, rej: any): void => {
          const timeout = 15_000;
          setTimeout((): void => rej(new Error(`Took longer than ${timeout / 1000}s`)), timeout);
        }),
      ])) as string;
    } catch (e) {
      this.log.warn(
        `Failed to fetch swap rate from ${priceOracleType} for ${from} to ${to}: ${e.message}`,
      );
      if (process.env.NODE_ENV === "development") {
        newRate = await this.config.getHardcodedRate(from, to);
        if (!newRate) {
          this.log.warn(`No default rate for swap from ${from} to ${to}, returning zero.`);
          return "0";
        }
      }
    }

    if (newRate === "0" || newRate === "Infinity") {
      this.log.debug(`Invalid swap rate for ${from} to ${to}: ${newRate}`);
      return undefined;
    }

    const newSwap: SwapRate = {
      from,
      to,
      rate: newRate!,
      priceOracleType,
      blockNumber,
      fromChainId: chainId,
      toChainId: chainId,
    };
    if (rateIndex !== -1) {
      oldRate = this.latestSwapRates[rateIndex]?.rate;
      this.latestSwapRates[rateIndex] = newSwap;
    } else {
      let rates: SwapRate[] = this.latestSwapRates.get(chainId)!;
      if (!rates) {
        rates = [];
      }
      rates.push(newSwap);
      this.latestSwapRates.set(chainId, rates);
    }
    const oldRateBn = parseEther(oldRate || "0");
    const newRateBn = parseEther(newRate || "0");
    if (!oldRateBn.eq(newRateBn)) {
      this.log.info(
        `Got swap rate at block ${blockNumber} for ${from} to ${to} on chain ${chainId}: ${newRate}`,
      );
      this.broadcastRate(from, to, chainId); // Only broadcast the rate if it's changed
    }
    return newRate;
  }

  async getUniswapRate(from: string, to: string): Promise<string> {
    const fromReserves = from !== AddressZero ? await getTokenReserves(from) : undefined;
    const toReserves = to !== AddressZero ? await getTokenReserves(to) : undefined;
    return getMarketDetails(fromReserves, toReserves).marketRate.rate.toString();
  }

  async broadcastRate(from: string, to: string, chainId: number): Promise<void> {
    const swap = this.latestSwapRates
      .get(chainId)!
      .find((s: SwapRate) => s.from === from && s.to === to);
    if (!swap) {
      throw new Error(`No rate exists for ${from} to ${to}`);
    }
    this.messaging.publish(`swap-rate.${from}.${to}`, {
      swapRate: swap.rate,
    });
  }

  async onModuleInit(): Promise<void> {
    this.config.providers.forEach(async (provider, chainId) => {
      // setup interval for swaps
      const swaps = this.config.getAllowedSwaps(chainId);
      for (const swap of swaps) {
        // If uniswap, poll for a new swap rate every 15s
        if (swap.priceOracleType === PriceOracleTypes.UNISWAP) {
          setInterval(async () => {
            const blockNumber = await provider.getBlockNumber();
            this.log.debug(
              `Querying chain listener for swaps from ${swap.from} to ${swap.to} on chain ${chainId}`,
            );
            this.fetchSwapRate(swap.from, swap.to, swap.priceOracleType, chainId, blockNumber);
          }, 15_000);

          // If hardcoded, set the swap rate once & then we're done
        } else if (swap.priceOracleType === PriceOracleTypes.HARDCODED) {
          const blockNumber = await provider.getBlockNumber();
          this.log.info(
            `Using hardcoded value for swaps from ${swap.from} to ${swap.to} on chain ${chainId}`,
          );
          this.fetchSwapRate(swap.from, swap.to, swap.priceOracleType, chainId, blockNumber);
        }
      }
    });
  }
}
