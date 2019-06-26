import { Controller, Get } from "@nestjs/common";

import { ConfigService } from "./config.service";

@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getConfig(): string {
    return JSON.stringify({
      addresses: this.configService.getEthAddresses(4447),
      network: this.configService.getEthProviderConfig().ethNetwork,
    });
  }
}
