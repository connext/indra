import { NotFoundException } from "@nestjs/common";
import { AddressZero } from "ethers/constants";
import { EntityManager, EntityRepository, Repository } from "typeorm";

import { defaultPaymentProfileEth } from "../constants";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { CLogger } from "../util";

import { Channel } from "./channel.entity";

const logger = new CLogger("ChannelRepository");

@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
  async findByMultisigAddress(multisigAddress: string): Promise<Channel | undefined> {
    return await this.findOne({
      where: { multisigAddress },
    });
  }

  async findByUserPublicIdentifier(userPublicIdentifier: string): Promise<Channel | undefined> {
    return await this.findOne({
      where: { userPublicIdentifier },
    });
  }

  async addPaymentProfileToChannel(
    userPublicIdentifier: string,
    paymentProfile: PaymentProfile,
  ): Promise<PaymentProfile> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.paymentProfiles", "paymentProfiles")
      .where("channel.userPublicIdentifier = :userPublicIdentifier", { userPublicIdentifier })
      .getOne();

    if (!channel) {
      throw new NotFoundException(
        `Channel does not exist for userPublicIdentifier ${userPublicIdentifier}`,
      );
    }

    const existing = channel.paymentProfiles.find(
      (prof: PaymentProfile) => prof.tokenAddress === paymentProfile.tokenAddress,
    );

    await this.manager.transaction(async (transactionalEntityManager: EntityManager) => {
      await transactionalEntityManager.save(paymentProfile);

      if (existing) {
        logger.log(`Found existing profile for token ${paymentProfile.tokenAddress}, replacing`);
        await transactionalEntityManager
          .createQueryBuilder()
          .relation(Channel, "paymentProfiles")
          .of(channel)
          .remove(existing);
      }

      return await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "paymentProfiles")
        .of(channel)
        .add(paymentProfile);
    });
    return paymentProfile;
  }

  async getPaymentProfileForChannelAndToken(
    userPublicIdentifier: string,
    tokenAddress: string = AddressZero,
  ): Promise<PaymentProfile> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.paymentProfiles", "paymentProfiles")
      .where("channel.userPublicIdentifier = :userPublicIdentifier", { userPublicIdentifier })
      .getOne();

    if (!channel) {
      throw new NotFoundException(
        `Channel does not exist for userPublicIdentifier ${userPublicIdentifier}`,
      );
    }

    const profile = channel.paymentProfiles.find(
      (prof: PaymentProfile) => prof.tokenAddress === tokenAddress,
    );

    if (!profile) {
      if (tokenAddress === AddressZero) {
        return defaultPaymentProfileEth;
      }
      // TODO: add default token profiles?
      throw new Error(
        `Payment profile does not exists for user ${userPublicIdentifier} and token ${tokenAddress}`,
      );
    }
    return profile;
  }
}
