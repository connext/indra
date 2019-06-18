import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { CreateUserDto } from "./dto/create-user.dto";
import { User } from "./user.entity";
import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
  ) {}
  @Get(":xpub")
  async findByXpub(@Param("xpub") xpub: string): Promise<User | {}> {
    return (await this.userRepository.findByXpub(xpub)) || {};
  }

  // TODO: validation
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return await this.userService.create(createUserDto);
  }
}
