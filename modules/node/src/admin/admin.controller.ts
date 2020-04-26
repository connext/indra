import { Controller, Post, Body } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";
import { ChannelService } from "../channel/channel.service";

import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly channelService: ChannelService,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("AdminController");
  }

  @Post("nodetonode")
  async getNonce(@Body() bodyParams: { userIdentifier: string }): Promise<string> {
    const channel = await this.channelService.create(bodyParams.userIdentifier);
    return channel.multisigAddress;
  }
}
