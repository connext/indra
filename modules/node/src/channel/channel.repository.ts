import { StateChannelJSON } from "@connext/types";
import { NotFoundException } from "@nestjs/common";
import { AddressZero } from "ethers/constants";
import { EntityManager, EntityRepository, Repository } from "typeorm";

import {
  convertAppToInstanceJSON,
  convertAppToProposedInstanceJSON,
} from "../appInstance/appInstance.repository";
import { LoggerService } from "../logger/logger.service";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";

import { Channel } from "./channel.entity";

const logger = new LoggerService("ChannelRepository");

const convertChannelToJSON = (channel: Channel): StateChannelJSON => {
  return {
    addresses: channel.addresses,
    appInstances: channel.appInstances.map(app => [
      app.identityHash,
      convertAppToInstanceJSON(app, channel),
    ]),
    freeBalanceAppInstance: convertAppToInstanceJSON(channel.freeBalanceAppInstance, channel),
    monotonicNumProposedApps: channel.monotonicNumProposedApps,
    multisigAddress: channel.multisigAddress,
    proposedAppInstances: channel.proposedAppInstances.map(app => [
      app.identityHash,
      convertAppToProposedInstanceJSON(app),
    ]),
    schemaVersion: channel.schemaVersion,
    singleAssetTwoPartyIntermediaryAgreements: channel.singleAssetTwoPartyIntermediaryAgreements,
    userNeuteredExtendedKeys: [channel.nodePublicIdentifier, channel.userPublicIdentifier],
  };
};

@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    const channel = await this.findByMultisigAddress(multisigAddress);
    if (!channel) {
      return undefined;
    }
    return convertChannelToJSON(channel);
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    const [channel] = (
      await Promise.all(owners.map(owner => this.findByUserPublicIdentifier(owner)))
    ).filter(chan => !!chan);
    if (!channel) {
      return undefined;
    }
    return convertChannelToJSON(channel);
  }

  async getStateChannelByAppInstanceId(
    appInstanceId: string,
  ): Promise<StateChannelJSON | undefined> {
    const channel = await this.findByAppInstanceId(appInstanceId);
    if (!channel) {
      return undefined;
    }
    return convertChannelToJSON(channel);
  }

  async findAll(available: boolean = true): Promise<Channel[]> {
    return this.find({ where: { available } });
  }

  async findByMultisigAddress(multisigAddress: string): Promise<Channel | undefined> {
    return this.findOne({
      where: { multisigAddress },
    });
  }

  async findByUserPublicIdentifier(userPublicIdentifier: string): Promise<Channel | undefined> {
    return this.findOne({
      where: { userPublicIdentifier },
    });
  }

  async findByAppInstanceId(appInstanceId: string): Promise<Channel | undefined> {
    return this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.proposedAppInstances", "proposedAppInstance")
      .leftJoinAndSelect("channel.appInstances", "appInstance")
      .leftJoinAndSelect("channel.freeBalanceAppInstance", "freeBalanceAppInstance")
      .where("proposedAppInstance.identityHash = :appInstanceId", { appInstanceId })
      .orWhere("appInstance.identityHash = :appInstanceId", { appInstanceId })
      .orWhere("freeBalanceAppInstance.identityHash = :appInstanceId", { appInstanceId })
      .getOne();
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
      throw new NotFoundException(
        `Channel does not exist for userPublicIdentifier ${userPublicIdentifier}`,
      );
    }

    const existing = channel.rebalanceProfiles.find(
      (prof: RebalanceProfile) => prof.assetId === rebalanceProfile.assetId,
    );

    await this.manager.transaction(async (transactionalEntityManager: EntityManager) => {
      await transactionalEntityManager.save(rebalanceProfile);

      if (existing) {
        logger.debug(`Found existing profile for token ${rebalanceProfile.assetId}, replacing`);
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

  async getRebalanceProfileForChannelAndAsset(
    userPublicIdentifier: string,
    assetId: string = AddressZero,
  ): Promise<RebalanceProfile | undefined> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.rebalanceProfiles", "rebalanceProfiles")
      .where("channel.userPublicIdentifier = :userPublicIdentifier", { userPublicIdentifier })
      .getOne();

    if (!channel) {
      throw new NotFoundException(
        `Channel does not exist for userPublicIdentifier ${userPublicIdentifier}`,
      );
    }

    const profile = channel.rebalanceProfiles.find(
      (prof: RebalanceProfile) => prof.assetId.toLowerCase() === assetId.toLowerCase(),
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
