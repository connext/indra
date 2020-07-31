import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "./config/config.service";
import { MessagingProviderId } from "./constants";
import { MessagingService } from "@connext/messaging";
import { LoggerService } from "./logger/logger.service";
import { Interval } from "@nestjs/schedule";
import { collectDefaultMetrics, Gauge } from "prom-client";
import { providers, utils } from "ethers";

@Injectable()
export class AppService {
  private chainGauges: Map<number, Gauge<string>> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    @Inject(MessagingProviderId) private readonly messaging: MessagingService,
  ) {
    this.log.setContext("SwapRateService");
    collectDefaultMetrics();
    const chainProviders = this.configService.getIndraChainProviders();
    Object.keys(chainProviders).forEach((chainId) =>
      this.chainGauges.set(
        parseInt(chainId),
        new Gauge({
          name: `chain_balance_${chainId}`,
          help: `chain_balance_${chainId}`,
        }),
      ),
    );
  }

  @Interval(30_000)
  async getChainBalances(): Promise<void> {
    for (const [chainId, gauge] of this.chainGauges.entries()) {
      const chainProviders = this.configService.getIndraChainProviders();
      const ethProvider = new providers.JsonRpcProvider(
        chainProviders[chainId],
        chainId === 61 ? "classic" : chainId,
      );
      const balance = await ethProvider.getBalance(this.configService.getSignerAddress());

      gauge.set(parseFloat(utils.formatEther(balance)));
    }
  }
}
