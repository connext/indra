import { MessagingService } from "@connext/messaging";
import { getEthProvider } from "@connext/utils";
import { Injectable, Inject } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { utils } from "ethers";
import { collectDefaultMetrics, Gauge } from "prom-client";

import { ConfigService } from "./config/config.service";
import { MessagingProviderId } from "./constants";
import { LoggerService } from "./logger/logger.service";

@Injectable()
export class AppService {
  private chainGauges: Map<number, Gauge<string>> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    @Inject(MessagingProviderId) private readonly messaging: MessagingService,
  ) {
    this.log.setContext("AppService");
    try {
      collectDefaultMetrics();
    } catch (e) {
      this.log.warn(e.message);
    }

    const chainProviders = this.configService.getIndraChainProviders();
    Object.keys(chainProviders).forEach((chainId) => {
      try {
        this.chainGauges.set(
          parseInt(chainId, 10),
          new Gauge({
            name: `chain_balance_${chainId}`,
            help: `chain_balance_${chainId}`,
          }),
        );
      } catch (e) {
        if (e.message.includes(`${chainId} has already been registered`)) {
          this.log.warn(e.message);
        } else {
          throw e;
        }
      }

    });
  }

  @Interval(30_000)
  async getChainBalances(): Promise<void> {
    for (const [chainId, gauge] of this.chainGauges.entries()) {
      const chainProviders = this.configService.getIndraChainProviders();
      const ethProvider = getEthProvider(chainProviders[chainId], chainId);
      const balance = await ethProvider.getBalance(this.configService.getSignerAddress());
      gauge.set(parseFloat(utils.formatEther(balance)));
    }
  }

  onApplicationShutdown(signal: string) {
    this.log.warn(`App is shutting down with signal: ${signal}`);
  }
}
