import { Node as NodeTypes } from "@counterfactual/types";
import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { parseEther } from "ethers/utils";

import { UserService } from "../user/user.service";

import { ChannelService } from "./channel.service";
import { CreateChannelDto } from "./dto/create-channel.dto";
import { DepositDto } from "./dto/deposit-dto";

@Controller("channels")
export class ChannelController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly userService: UserService,
  ) {}

  @Post()
  async create(
    @Body() createChannelDto: CreateChannelDto,
  ): Promise<{ transactionHash: string }> {
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

  @Post("deposit/:multisigAddress")
  async deposit(
    @Param("multisigAddress") multisigAddress: string,
    @Body() depositDto: DepositDto,
  ): Promise<NodeTypes.DepositResult> {
    return await this.channelService.deposit(
      multisigAddress,
      parseEther(depositDto.amount),
      depositDto.notifyCounterparty,
    );
  }
}
