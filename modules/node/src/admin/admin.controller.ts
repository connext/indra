import { Controller, Post, Body } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";
import { ChannelService } from "../channel/channel.service";
import { ChannelRepository } from "../channel/channel.repository";

import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly channelService: ChannelService,
    private readonly channelRepository: ChannelRepository,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("AdminController");
  }

  @Post("nodetonode")
  async getNonce(@Body() bodyParams: { userIdentifier: string }): Promise<string> {
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
