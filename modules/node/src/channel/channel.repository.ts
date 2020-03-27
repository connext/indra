import { StateChannelJSON, AppInstanceProposal } from "@connext/types";
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
import { AppType, AppInstance } from "../appInstance/appInstance.entity";
import { bigNumberify } from "ethers/utils";

const log = new LoggerService("ChannelRepository");

export const convertChannelToJSON = (channel: Channel): StateChannelJSON => {
  const json: StateChannelJSON = {
    addresses: channel.addresses,
    appInstances: channel.appInstances
      .filter(app => app.type === AppType.INSTANCE)
      .map(app => [app.identityHash, convertAppToInstanceJSON(app, channel)]),
    freeBalanceAppInstance: convertAppToInstanceJSON(
      channel.appInstances.find(app => app.type === AppType.FREE_BALANCE),
      channel,
    ),
    monotonicNumProposedApps: channel.monotonicNumProposedApps,
    multisigAddress: channel.multisigAddress,
    proposedAppInstances: channel.appInstances
      .filter(app => app.type === AppType.PROPOSAL)
      .map(app => [app.identityHash, convertAppToProposedInstanceJSON(app)]),
    schemaVersion: channel.schemaVersion,
    userNeuteredExtendedKeys: [channel.nodePublicIdentifier, channel.userPublicIdentifier].sort(),
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

  async createAppProposal(
    multisigAddress: string,
    appProposal: AppInstanceProposal,
    numProposedApps: number,
  ): Promise<void> {
    const channel = await this.findByMultisigAddressOrThrow(multisigAddress);

    const app = new AppInstance();
    app.type = AppType.PROPOSAL;
    app.identityHash = appProposal.identityHash;
    app.actionEncoding = appProposal.abiEncodings.actionEncoding;
    app.stateEncoding = appProposal.abiEncodings.stateEncoding;
    app.appDefinition = appProposal.appDefinition;
    app.appSeqNo = appProposal.appSeqNo;
    app.initialState = appProposal.initialState;
    app.initiatorDeposit = bigNumberify(appProposal.initiatorDeposit);
    app.initiatorDepositTokenAddress = appProposal.initiatorDepositTokenAddress;
    app.latestState = appProposal.initialState;
    app.latestTimeout = bigNumberify(appProposal.timeout).toNumber();
    app.latestVersionNumber = 0;
    app.responderDeposit = bigNumberify(appProposal.responderDeposit);
    app.responderDepositTokenAddress = appProposal.responderDepositTokenAddress;
    app.timeout = bigNumberify(appProposal.timeout).toNumber();
    app.proposedToIdentifier = appProposal.proposedToIdentifier;
    app.proposedByIdentifier = appProposal.proposedByIdentifier;
    app.outcomeType = appProposal.outcomeType;
    app.meta = appProposal.meta;

    channel.monotonicNumProposedApps = numProposedApps;
    channel.appInstances.push(app);
    await this.save(channel);
  }
  // NODE-SPECIFIC METHODS

  async findAll(available: boolean = true): Promise<Channel[]> {
    return this.find({ where: { available } });
  }

  async findByMultisigAddress(multisigAddress: string): Promise<Channel | undefined> {
    return this.findOne({
      where: { multisigAddress },
      relations: ["appInstances"],
    });
  }

  async findByUserPublicIdentifier(userPublicIdentifier: string): Promise<Channel | undefined> {
    return this.findOne({
      where: { userPublicIdentifier },
      relations: ["appInstances"],
    });
  }

  async findByAppInstanceId(appInstanceId: string): Promise<Channel | undefined> {
    // TODO: fix this query
    // when you return just `channel` you will only have one app instance
    // that matches the appId
    const channel = await this.createQueryBuilder("channel")
      .leftJoin("channel.appInstances", "appInstance")
      .where("appInstance.identityHash = :appInstanceId", { appInstanceId })
      .getOne();
    return this.findOne({
      where: { id: channel.id },
      relations: ["appInstances"],
    });
  }

  async findByMultisigAddressOrThrow(multisigAddress: string): Promise<Channel> {
    const channel = await this.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`Channel does not exist for multisig ${multisigAddress}`);
    }
    return channel;
  }

  async findByUserPublicIdentifierOrThrow(userPublicIdentifier: string): Promise<Channel> {
    const channel = await this.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`Channel does not exist for userPublicIdentifier ${userPublicIdentifier}`);
    }

    return channel;
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
        log.debug(`Found existing profile for token ${rebalanceProfile.assetId}, replacing`);
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
    await this.save(channel);
    return channel;
  }
}
