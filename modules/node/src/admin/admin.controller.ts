import { Controller, Post, Body, BadRequestException } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";
import { ChannelService } from "../channel/channel.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly configService: ConfigService,
    private readonly channelService: ChannelService,
    private readonly channelRepository: ChannelRepository,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("AdminController");
  }

  @Post("nodetonode")
  async getNonce(@Body() bodyParams: { userIdentifier: string }): Promise<string> {
    if (!this.configService.getFeatureFlags().multihop) {
      throw new BadRequestException(`Feature not supported: multihop`);
    }
    const { userIdentifier } = bodyParams;
    const existing = await this.channelRepository.findByUserPublicIdentifier(userIdentifier);
    if (existing) {
      this.log.info(`Found existing node to node channel for ${userIdentifier}`);
      return existing.multisigAddress;
    } else {
      this.log.info(`Creating node to node channel for ${userIdentifier}`);
      const channel = await this.channelService.create(userIdentifier);
      return channel.multisigAddress;
    }
  }
}
