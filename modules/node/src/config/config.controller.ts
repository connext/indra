import { Controller, Get } from "@nestjs/common";
import { NodeResponses } from "@connext/types";

import { ConfigService } from "./config.service";

@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async getConfig(): Promise<string> {
    return JSON.stringify({
      contractAddresses: await this.configService.getContractAddresses(),
      ethNetwork: await this.configService.getEthNetwork(),
      supportedTokenAddresses: this.configService.getSupportedTokenAddresses(),
      messagingUrl: this.configService.getMessagingConfig().messagingUrl,
      nodeIdentifier: this.configService.getPublicIdentifier(),
      signerAddress: await this.configService.getSignerAddress(),
    } as NodeResponses.GetConfig);
  }
}
