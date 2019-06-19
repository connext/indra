import { Node } from "@counterfactual/node";
import { Controller, Get, Inject } from "@nestjs/common";
import { NodeProviderId } from "src/constants";

import { ConfigService } from "./config.service";

type PublicConfig = {
  nodePublicIdentifier: string; // x-pub of node
  chainId: string; // network that your channel is on
  nodeUrl: string;
};

@Controller("config")
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(NodeProviderId) private readonly node: Node,
  ) {}

  @Get()
  async config(): Promise<PublicConfig> {
    // TODO: are these the right values?
    return {
      chainId: this.configService.get("ETH_NETWORK"),
      nodePublicIdentifier: this.node.publicIdentifier,
      nodeUrl: this.configService.get("INDRA_NATS_SERVERS"),
    };
  }
}
