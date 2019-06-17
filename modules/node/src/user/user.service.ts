import { BadRequestException, Injectable } from "@nestjs/common";

import { CLogger } from "../util/logger";

import { CreateUserDto } from "./dto/create-user.dto";
import { User } from "./user.entity";
import { UserRepository } from "./user.repository";

const logger = new CLogger("UserService");

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { xpubId: createUserDto.xpub },
    });
    if (existing) {
      throw new BadRequestException("User exists.");
    }

    const user = this.userRepository.create({
      xpub: createUserDto.xpub,
    });
    return await this.userRepository.save(user);
  }
}
