import { Controller, Post, Body } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";
import { ChannelService } from "../channel/channel.service";

import { AdminService } from "./admin.service";
import { stringify } from "@connext/utils";

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
    let multisigAddress: string;
    this.log.warn(`Creating node to node channel`)
    try {
      multisigAddress = (await this.channelService.create(bodyParams.userIdentifier)).multisigAddress;
    } catch (e) {
      this.log.error(e)
    }
    if(!multisigAddress) {
      multisigAddress = (await this.channelService.getStateChannel(bodyParams.userIdentifier)).multisigAddress;
    }
    this.log.warn(`Address: ${multisigAddress}`)
    return multisigAddress;
  }
}
