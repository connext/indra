import { Controller, Injectable, PipeTransform, ArgumentMetadata, UsePipes } from "@nestjs/common";
import { MessagePattern, Ctx, NatsContext, Payload, RpcException } from "@nestjs/microservices";

import { isXpub } from "../util";

import { ChannelService } from "./channel.service";
import { ChannelRepository } from "./channel.repository";
import { GetChannelResponse } from "@connext/types";

@Injectable()
export class ValidatePublicIdentifierPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const xpub = value
      .getSubject()
      .split(".")
      .pop();

    if (!isXpub(xpub)) {
      throw new RpcException("Invalid xpub");
    }

    console.log("xpub: ", xpub);
    return xpub;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [NatsContext];
    return types.includes(metatype);
  }
}

@Controller()
export class ChannelController {
  constructor(private readonly channelService: ChannelService, private readonly channelRepository: ChannelRepository) {}

  @MessagePattern("channel.gettest.>")
  @UsePipes(new ValidatePublicIdentifierPipe())
  async getChannel(@Payload() data: any, @Ctx() publicIdentifier: NatsContext) {
    return (await this.channelRepository.findByUserPublicIdentifier(
      (publicIdentifier as unknown) as string,
    )) as GetChannelResponse;
  }
}
