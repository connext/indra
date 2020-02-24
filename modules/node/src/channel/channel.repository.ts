import { StateChannelJSON, AppInstanceJson, AppInstanceProposal } from "@connext/types";
import { NotFoundException } from "@nestjs/common";
import { AddressZero } from "ethers/constants";
import { EntityManager, EntityRepository, Repository } from "typeorm";

import { AppInstance } from "../appInstance/appInstance.entity";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { CLogger } from "../util";

import { Channel } from "./channel.entity";

const logger = new CLogger("ChannelRepository");

const convertAppToInstanceJSON = (app: AppInstance, channel: Channel): AppInstanceJson => {
  return {
    appInterface: app.appInterface,
    appSeqNo: app.appSeqNo,
    defaultTimeout: parseInt(app.timeout), // TODO: is this right?
    identityHash: app.identityHash,
    isVirtualApp: false, // hardcode
    latestState: app.latestState,
    latestTimeout: app.latestTimeout,
    latestVersionNumber: app.latestVersionNumber,
    multisigAddress: channel.multisigAddress,
    outcomeType: (app.outcomeType as unknown) as number,
    participants: channel.userNeuteredExtendedKeys,
    multiAssetMultiPartyCoinTransferInterpreterParams:
      app.multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams:
      app.singleAssetTwoPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams: app.twoPartyOutcomeInterpreterParams,
  };
};

const convertAppToProposedInstanceJSON = (app: AppInstance): AppInstanceProposal => {
  return {
    abiEncodings,
    appDefinition,
    appSeqNo,
    identityHash,
    initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    outcomeType,
    proposedByIdentifier,
    proposedToIdentifier,
    responderDeposit,
    responderDepositTokenAddress,
    timeout,
    intermediaryIdentifier,
    multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams
  }
}

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
    proposedAppInstances,
    schemaVersion,
    singleAssetTwoPartyIntermediaryAgreements,
    userNeuteredExtendedKeys,
  };
};

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

  async findByMultisigAddressAsJSON(
    multisigAddress: string,
  ): Promise<StateChannelJSON | undefined> {
    const channel = await this.findByMultisigAddress(multisigAddress);
    if (!channel) {
      return undefined;
    }
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
