import { Body, Controller, NotFoundException, Post } from "@nestjs/common";

import { UserService } from "../user/user.service";

import { ChannelService } from "./channel.service";
import { CreateChannelDto } from "./dto/create-channel.dto";

@Controller("channels")
export class ChannelController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly userService: UserService,
  ) {}

  @Post()
  async create(@Body() createChannelDto: CreateChannelDto) {
    const user = await this.userService.findByEthAddress(
      createChannelDto.ethAddress,
    );
    if (!user) {
      throw new NotFoundException();
    }
    const { transactionHash } = await this.channelService.create(
      user.nodeAddress,
    );
    return { transactionHash };
  }
}
