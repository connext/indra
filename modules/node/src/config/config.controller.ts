import { Controller, Get } from "@nestjs/common";

import { ConfigService } from "./config.service";

@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async getConfig(): Promise<string> {
    return JSON.stringify({
      contractAddresses: await this.configService.getContractAddresses(),
      ethNetwork: await this.configService.getEthNetwork(),
      supportedTokens: this.configService.getSupportedTokenAddresses(),
    });
  }
}
