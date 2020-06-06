import { StateChannelJSON } from "@connext/types";
import { NotFoundException } from "@nestjs/common";
import { constants } from "ethers";
import { EntityManager, EntityRepository, Repository } from "typeorm";

import { convertAppToInstanceJSON } from "../appInstance/appInstance.repository";
import { LoggerService } from "../logger/logger.service";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";

import { Channel } from "./channel.entity";
import { AppType } from "../appInstance/appInstance.entity";

const { AddressZero } = constants;

const log = new LoggerService("ChannelRepository");

export const convertChannelToJSON = (channel: Channel): StateChannelJSON => {
  const json: StateChannelJSON = {
    addresses: channel.addresses,
    appInstances: (channel.appInstances || [])
      .filter((app) => app.type === AppType.INSTANCE)
      .map((app) => [app.identityHash, convertAppToInstanceJSON(app, channel)]),
    freeBalanceAppInstance: convertAppToInstanceJSON(
      (channel.appInstances || []).find((app) => app.type === AppType.FREE_BALANCE),
      channel,
    ),
    monotonicNumProposedApps: channel.monotonicNumProposedApps,
    multisigAddress: channel.multisigAddress,
    proposedAppInstances: (channel.appInstances || [])
      .filter((app) => app.type === AppType.PROPOSAL)
      .map((app) => [app.identityHash, convertAppToInstanceJSON(app, channel)]),
    schemaVersion: channel.schemaVersion,
    userIdentifiers: [channel.nodeIdentifier, channel.userIdentifier], // always [initiator, responder] -- node will always be initiator
  };
  return json;
};

@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
  // CF-CORE STORE METHODS
  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    const channel = await this.findByMultisigAddress(multisigAddress);
    return channel && convertChannelToJSON(channel);
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    const channel = await this.findByOwners(owners);
    if (!channel) {
      return undefined;
    }
    return convertChannelToJSON(channel);
  }

  async getStateChannelByAppIdentityHash(
    appIdentityHash: string,
  ): Promise<StateChannelJSON | undefined> {
    const channel = await this.findByAppIdentityHash(appIdentityHash);
    if (!channel) {
      return undefined;
    }
    return convertChannelToJSON(channel);
  }

  // NODE-SPECIFIC METHODS

  async findAll(available: boolean = true): Promise<Channel[]> {
    return this.find({ where: { available } });
  }

  async findByOwners(owners: string[]): Promise<Channel|undefined> {
    return this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.appInstances", "appInstance")
      .where("channel.userIdentifier IN (:...owners)", { owners })
      .getOne();
  }

  async findByMultisigAddress(multisigAddress: string): Promise<Channel | undefined> {
    return this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.appInstances", "appInstance")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress })
      .getOne();
  }

  async findByUserPublicIdentifier(userIdentifier: string): Promise<Channel | undefined> {
    log.debug(`Retrieving channel for user ${userIdentifier}`);
    return this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.appInstances", "appInstance")
      .where("channel.userIdentifier = :userIdentifier", { userIdentifier })
      .getOne();
  }

  async findByAppIdentityHash(appIdentityHash: string): Promise<Channel | undefined> {
    // TODO: fix this query
    // when you return just `channel` you will only have one app instance
    // that matches the appId
    const channel = await this.createQueryBuilder("channel")
      .leftJoin("channel.appInstances", "appInstance")
      .where("appInstance.identityHash = :appIdentityHash", { appIdentityHash })
      .getOne();
    if (!channel) {
      return undefined;
    }
    return this.findOne(channel.multisigAddress, {
      relations: ["appInstances"],
    });
  }

  async findByAppIdentityHashOrThrow(appIdentityHash: string): Promise<Channel> {
    const channel = await this.findByAppIdentityHash(appIdentityHash);
    if (!channel) {
      throw new Error(`Channel does not exist for app ${appIdentityHash}`);
    }
    return channel;
  }

  async findByMultisigAddressOrThrow(multisigAddress: string): Promise<Channel> {
    const channel = await this.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`Channel does not exist for multisig ${multisigAddress}`);
    }
    return channel;
  }

  async findByUserPublicIdentifierOrThrow(userIdentifier: string): Promise<Channel> {
    const channel = await this.findByUserPublicIdentifier(userIdentifier);
    if (!channel) {
      throw new Error(`Channel does not exist for userIdentifier ${userIdentifier}`);
    }

    return channel;
  }

  async addRebalanceProfileToChannel(
    userIdentifier: string,
    rebalanceProfile: RebalanceProfile,
  ): Promise<RebalanceProfile> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.rebalanceProfiles", "rebalanceProfiles")
      .where("channel.userIdentifier = :userIdentifier", { userIdentifier })
      .getOne();

    if (!channel) {
      throw new NotFoundException(`Channel does not exist for userIdentifier ${userIdentifier}`);
    }

    const existing = channel.rebalanceProfiles.find(
      (prof: RebalanceProfile) => prof.assetId === rebalanceProfile.assetId,
    );

    await this.manager.transaction(async (transactionalEntityManager: EntityManager) => {
      await transactionalEntityManager.save(rebalanceProfile);

      if (existing) {
        log.debug(`Found existing profile for token ${rebalanceProfile.assetId}, replacing`);
        await transactionalEntityManager
          .createQueryBuilder()
          .relation(Channel, "rebalanceProfiles")
          .of(channel)
          .remove(existing);
      }

      return transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "rebalanceProfiles")
        .of(channel)
        .add(rebalanceProfile);
    });
    return rebalanceProfile;
  }

  async getRebalanceProfileForChannelAndAsset(
    userIdentifier: string,
    assetId: string = AddressZero,
  ): Promise<RebalanceProfile | undefined> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.rebalanceProfiles", "rebalanceProfiles")
      .where("channel.userIdentifier = :userIdentifier", { userIdentifier })
      .getOne();

    if (!channel) {
      throw new NotFoundException(`Channel does not exist for userIdentifier ${userIdentifier}`);
    }

    const profile = channel.rebalanceProfiles.find(
      (prof: RebalanceProfile) => prof.assetId.toLowerCase() === assetId.toLowerCase(),
    );

    return profile;
  }

  async setInflightCollateralization(
    channel: Channel,
    assetId: string,
    collateralizationInFlight: boolean,
  ): Promise<void> {
    const toSave = {
      ...channel.activeCollateralizations,
      [assetId]: collateralizationInFlight,
    };
    const query = this.createQueryBuilder()
      .update(Channel)
      .set({
        activeCollateralizations: toSave,
      })
      .where("multisigAddress = :multisigAddress", { multisigAddress: channel.multisigAddress });
    await query.execute();
  }
}
