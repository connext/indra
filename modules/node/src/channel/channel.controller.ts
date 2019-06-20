import { Node as NodeTypes } from "@counterfactual/types";
import { Body, Controller, Param, Post } from "@nestjs/common";
import { parseEther } from "ethers/utils";

import { ChannelService } from "./channel.service";
import { DepositDto } from "./dto/deposit-dto";

@Controller("channels")
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

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
