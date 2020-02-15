import { NotFoundException } from "@nestjs/common";
import { AddressZero } from "ethers/constants";
import { EntityManager, EntityRepository, Repository } from "typeorm";

import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
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

  async addRebalanceProfileToChannel(
    userPublicIdentifier: string,
    rebalanceProfile: RebalanceProfile,
  ): Promise<RebalanceProfile> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.rebalanceProfiles", "rebalanceProfiles")
      .where("channel.userPublicIdentifier = :userPublicIdentifier", { userPublicIdentifier })
      .getOne();

    if (!channel) {
      throw new NotFoundException(`Channel does not exist for userPublicIdentifier ${userPublicIdentifier}`);
    }

    const existing = channel.rebalanceProfiles.find(
      (prof: RebalanceProfile) => prof.assetId === rebalanceProfile.assetId,
    );

    await this.manager.transaction(async (transactionalEntityManager: EntityManager) => {
      await transactionalEntityManager.save(rebalanceProfile);

      if (existing) {
        logger.log(`Found existing profile for token ${rebalanceProfile.assetId}, replacing`);
        await transactionalEntityManager
          .createQueryBuilder()
          .relation(Channel, "rebalanceProfiles")
          .of(channel)
          .remove(existing);
      }

      return await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "rebalanceProfiles")
        .of(channel)
        .add(rebalanceProfile);
    });
    return rebalanceProfile;
  }

  async getRebalanceProfileForChannelAndToken(
    userPublicIdentifier: string,
    assetId: string = AddressZero,
  ): Promise<RebalanceProfile | undefined> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.rebalanceProfiles", "rebalanceProfiles")
      .where("channel.userPublicIdentifier = :userPublicIdentifier", { userPublicIdentifier })
      .getOne();

    if (!channel) {
      throw new NotFoundException(`Channel does not exist for userPublicIdentifier ${userPublicIdentifier}`);
    }

    const profile = channel.rebalanceProfiles.find(
      (prof: RebalanceProfile) => prof.assetId.toLowerCase() === assetId.toLowerCase(),
    );

    return profile;
  }

  async setInflightCollateralization(channel: Channel, collateralizationInFlight: boolean): Promise<Channel> {
    channel.collateralizationInFlight = collateralizationInFlight;
    return await this.save(channel);
  }
}
