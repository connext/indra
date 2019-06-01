import { Body, Controller, Post } from "@nestjs/common";

import { CreateUserDto } from "./dto/create-user.dto";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  // TODO: validation
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto);
  }
}
