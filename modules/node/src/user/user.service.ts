import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Repository } from "typeorm";

import { UserRepoProviderId } from "../constants";

import { CreateUserDto } from "./dto/create-user.dto";
import { User } from "./user.entity";

@Injectable()
export class UserService {
  constructor(
    @Inject(UserRepoProviderId)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    let existing = await this.userRepository.findOne({
      where: { xpubId: createUserDto.xpub },
    });
    if (existing) {
      throw new BadRequestException("User exists.");
    }
    existing = await this.userRepository.findOne({
      where: { signingKey: createUserDto.signingKey },
    });
    if (existing) {
      throw new BadRequestException("Duplicate signing key.");
    }

    const user = this.userRepository.create({
      signingKey: createUserDto.signingKey,
      xpub: createUserDto.xpub,
    });
    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find();
  }

  async findByXpub(xpubId: string): Promise<User | undefined> {
    return await this.userRepository.findOne({ where: { xpubId } });
  }
}
