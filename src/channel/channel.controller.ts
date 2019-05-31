import { Body, Controller, Post } from "@nestjs/common";

import { UserService } from "../user/user.service";

import { ChannelService } from "./channel.service";

@Controller("channel")
export class ChannelController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly userService: UserService,
  ) {}

  @Post()
  async create(@Body() ethAddress: string) {
    const user = await this.userService.findByEthAddress(ethAddress);
    const { transactionHash } = await this.channelService.create(
      user.nodeAddress,
    );
    return { transactionHash };
  }
}
