import { Controller, Get, Param } from "@nestjs/common";
import { NodeResponses } from "@connext/types";

import { ConfigService } from "./config.service";

@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get("/:chainId")
  async getConfigByChain(@Param("chainId") chainId: string): Promise<string> {
    const chainIdInt = parseInt(chainId);
    return JSON.stringify({
      contractAddresses: this.configService.getAddressBook(chainIdInt),
      ethNetwork: await this.configService.getNetwork(chainIdInt),
      supportedTokenAddresses: this.configService.getSupportedTokens(),
      messagingUrl: this.configService.getMessagingConfig().messagingUrl,
      nodeIdentifier: this.configService.getPublicIdentifier(),
      signerAddress: await this.configService.getSignerAddress(),
    } as NodeResponses.GetConfig);
  }
}
