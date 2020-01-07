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
  async findAll(available: boolean = true): Promise<Channel[]> {
    return await this.find({ where: { available } });
  }

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
      (prof: PaymentProfile) => prof.assetId === paymentProfile.assetId,
    );

    await this.manager.transaction(async (transactionalEntityManager: EntityManager) => {
      await transactionalEntityManager.save(paymentProfile);

      if (existing) {
        logger.log(`Found existing profile for token ${paymentProfile.assetId}, replacing`);
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
    assetId: string = AddressZero,
  ): Promise<PaymentProfile | undefined> {
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
      (prof: PaymentProfile) => prof.assetId.toLowerCase() === assetId.toLowerCase(),
    );

    return profile;
  }

  async setInflightCollateralization(
    channel: Channel,
    collateralizationInFlight: boolean,
  ): Promise<Channel> {
    channel.collateralizationInFlight = collateralizationInFlight;
    return await this.save(channel);
  }
}
