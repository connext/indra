import { Controller, Get } from "@nestjs/common";

import { ConfigService } from "./config.service";

@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async getConfig(): Promise<string> {
    return JSON.stringify({
      addresses: await this.configService.getContractAddresses(),
      network: await this.configService.getEthNetwork(),
    });
  }
}
