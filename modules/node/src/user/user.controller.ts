import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CreateUserDto } from "./dto/create-user.dto";
import { User } from "./user.entity";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get(":xpub")
  async findByXpub(@Param("xpub") xpub: string): Promise<User | {}> {
    return (await this.userService.findByXpub(xpub)) || {};
  }

  // TODO: validation
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return await this.userService.create(createUserDto);
  }
}
