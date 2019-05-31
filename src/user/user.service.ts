import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";

import { UserRepoProviderId } from "../constants";

import { CreateUserDto } from "./create-user.dto";
import { User } from "./user.entity";

@Injectable()
export class UserService {
  constructor(
    @Inject(UserRepoProviderId)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    let existing = await this.userRepository.findOne({
      where: { username: createUserDto.username },
    });
    if (existing) {
      throw new BadRequestException("User exists.");
    }
    existing = await this.userRepository.findOne({
      where: { ethAddress: createUserDto.ethAddress },
    });
    if (existing) {
      throw new BadRequestException("ETH address.");
    }

    const user = this.userRepository.create({
      username: createUserDto.username,
      email: createUserDto.email,
      ethAddress: createUserDto.ethAddress,
      nodeAddress: createUserDto.nodeAddress,
    });
    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find();
  }

  async findByEthAddress(ethAddress: string): Promise<User> {
    return await this.userRepository.findOneOrFail({ where: { ethAddress } });
  }
}
