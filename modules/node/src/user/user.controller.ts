import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CreateUserDto } from "./dto/create-user.dto";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get(":ethAddress")
  async findByEthAddress(@Param("ethAddress") ethAddress: string) {
    return (await this.userService.findByEthAddress(ethAddress)) || {};
  }

  // TODO: validation
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto);
  }
}
