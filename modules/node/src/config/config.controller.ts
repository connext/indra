import { Controller, Get, Param } from "@nestjs/common";
import { NodeResponses } from "@connext/types";

import { ConfigService } from "./config.service";

@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async getConfig(): Promise<string> {
    const networks = {};
    for (const cId of this.configService.getSupportedChains()) {
      networks[cId] = await this.configService.getNetwork(cId);
    }
    return JSON.stringify({
      contractAddresses: this.configService.getContractAddressBook(),
      ethNetwork: {} as any,
      networks,
      supportedTokenAddresses: this.configService.getSupportedTokens(),
      messagingUrl: this.configService.getMessagingConfig().messagingUrl,
      nodeIdentifier: this.configService.getPublicIdentifier(),
      signerAddress: await this.configService.getSignerAddress(),
    } as NodeResponses.GetConfig);
  }

  @Get("/:chainId")
  async getConfigByChain(@Param("chainId") chainId?: string): Promise<string> {
    const chainIdInt = parseInt(chainId || "0");
    const networks = {};
    for (const cId of this.configService.getSupportedChains()) {
      networks[cId] = await this.configService.getNetwork(cId);
    }
    return JSON.stringify({
      contractAddresses: this.configService.getContractAddressBook(),
      ethNetwork: await this.configService.getNetwork(chainIdInt), // deprecate this
      networks,
      supportedTokenAddresses: this.configService.getSupportedTokens(),
      messagingUrl: this.configService.getMessagingConfig().messagingUrl,
      nodeIdentifier: this.configService.getPublicIdentifier(),
      signerAddress: await this.configService.getSignerAddress(),
    } as NodeResponses.GetConfig);
  }
}
