import { BadRequestException, Injectable } from "@nestjs/common";

import { CLogger } from "../util/logger";

import { CreateUserDto } from "./dto/create-user.dto";
import { User } from "./user.entity";
import { UserRepository } from "./user.repository";

@Injectable()
export class UserService {
  private logger: CLogger;

  constructor(private readonly userRepository: UserRepository) {
    this.logger = new CLogger("UserService");
  }

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
