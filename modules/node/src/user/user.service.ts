import { CreateChannelMessage } from "@counterfactual/node";
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
      where: { xpubId: createUserDto.xpubId },
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
      xpubId: createUserDto.xpubId,
    });
    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find();
  }

  async findByEthAddress(ethAddress: string): Promise<User | undefined> {
    return await this.userRepository.findOne({ where: { ethAddress } });
  }

  async addMultisig(nodeAddress, multisigAddress): Promise<User> {
    const user = await this.userRepository.findOneOrFail({
      where: { nodeAddress },
    });
    user.multisigAddress = multisigAddress;
    return await this.userRepository.save(user);
  }
}
