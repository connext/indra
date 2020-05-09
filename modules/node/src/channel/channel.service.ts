import {
  CreateChannelMessage,
  MethodResults,
  NodeResponses,
  RebalanceProfile as RebalanceProfileType,
  StateChannelJSON,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, maxBN, stringify } from "@connext/utils";
import { Injectable, HttpService } from "@nestjs/common";
import { AxiosResponse } from "axios";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, getAddress, toUtf8Bytes, sha256, bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { DepositService } from "../deposit/deposit.service";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";
import { TransactionReceipt } from "ethers/providers";

type RebalancingTargetsResponse<T = string> = {
  assetId: string;
  upperBoundCollateralize: T;
  lowerBoundCollateralize: T;
  upperBoundReclaim: T;
  lowerBoundReclaim: T;
};

export enum RebalanceType {
  COLLATERALIZE = "COLLATERALIZE",
  RECLAIM = "RECLAIM",
}

@Injectable()
export class ChannelService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelRepository: ChannelRepository,
    private readonly configService: ConfigService,
    private readonly withdrawService: WithdrawService,
    private readonly depositService: DepositService,
    private readonly log: LoggerService,
    private readonly httpService: HttpService,
  ) {
    this.log.setContext("ChannelService");
  }

  /**
   * Returns all channel records.
   * @param available available value of channel
   */
  async findAll(available: boolean = true): Promise<Channel[]> {
    return this.channelRepository.findAll(available);
  }

  // NOTE: this is used by the `channel.provider`. if you use the
  // repository at that level, there is some ordering weirdness
  // where an empty array is returned from the query call, then
  // the provider method returns, and the query is *ACTUALLY* executed
  async getByUserPublicIdentifier(
    userIdentifier: string,
  ): Promise<NodeResponses.GetChannel | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userIdentifier);
    this.log.debug(`Got channel for ${userIdentifier}: ${stringify(channel, true)}`);
    return !channel || !channel.multisigAddress
      ? undefined
      : {
          available: channel.available,
          activeCollateralizations: channel.activeCollateralizations,
          multisigAddress: channel.multisigAddress,
          nodeIdentifier: channel.nodeIdentifier,
          userIdentifier: channel.userIdentifier,
        };
  }

  /**
   * Starts create channel process within CF core
   * @param counterpartyIdentifier
   */
  async create(counterpartyIdentifier: string): Promise<MethodResults.CreateChannel> {
    this.log.info(`create ${counterpartyIdentifier} started`);
    const existing = await this.channelRepository.findByUserPublicIdentifier(
      counterpartyIdentifier,
    );
    if (existing) {
      throw new Error(`Channel already exists for ${counterpartyIdentifier}`);
    }

    const createResult = await this.cfCoreService.createChannel(counterpartyIdentifier);
    this.log.info(`create ${counterpartyIdentifier} finished: ${JSON.stringify(createResult)}`);
    return createResult;
  }

  async rebalance(
    channel: Channel,
    assetId: string = AddressZero,
  ): Promise<TransactionReceipt | undefined> {
    this.log.info(
      `rebalance for ${channel.userIdentifier} asset ${assetId} started`,
    );
    const normalizedAssetId = getAddress(assetId);

    const rebalancingTargets = await this.getRebalancingTargets(
      channel.userIdentifier,
      normalizedAssetId
    )

    const {
      lowerBoundCollateralize,
      upperBoundCollateralize,
      lowerBoundReclaim,
      upperBoundReclaim,
    } = rebalancingTargets;

    if (
      upperBoundCollateralize.lt(lowerBoundCollateralize) ||
      upperBoundReclaim.lt(lowerBoundReclaim)
    ) {
      throw new Error(`Rebalancing targets not properly configured: ${rebalancingTargets}`);
    }

    const {
      [this.cfCoreService.cfCore.signerAddress]: nodeFreeBalance,
    } = await this.cfCoreService.getFreeBalance(
      channel.userIdentifier,
      channel.multisigAddress,
      normalizedAssetId,
    );

    let receipt;
    // If free balance is too low, collateralize up to upper bound
    if ( nodeFreeBalance < lowerBoundCollateralize ) {
      const amount = upperBoundCollateralize.sub(nodeFreeBalance)
      receipt = await this.depositService.deposit(channel, amount, normalizedAssetId)
    } else {
      this.log.debug(`Free balance ${nodeFreeBalance} is greater than or equal to lower collateralization bound: ${lowerBoundCollateralize}`)
    }

    // If free balance is too high, reclaim down to lower bound
    if ( nodeFreeBalance > upperBoundReclaim ) {
      const amount = nodeFreeBalance.sub(lowerBoundReclaim)
      await this.withdrawService.withdraw(channel, amount, normalizedAssetId)
    } else {
      this.log.debug(`Free balance ${nodeFreeBalance} is less than or equal to `)
    }
    this.log.info(`rebalance finished for ${channel.userIdentifier}, assetId: ${assetId}`)
    return receipt as TransactionReceipt | undefined;
  }

  async getRebalancingTargets(
    userPublicIdentifier: string,
    assetId: string = AddressZero,
  ) {
    this.log.debug(`Getting rebalancing targets for user: ${userPublicIdentifier}, assetId: ${assetId}`);
    let targets;
    // option 1: rebalancing service, option 2: rebalance profile, option 3: default
    targets = await this.getDataFromRebalancingService(
      userPublicIdentifier,
      assetId,
    );

    if (!targets) {
      this.log.debug(`Unable to get rebalancing targets from service, falling back to profile`);
      targets = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
        userPublicIdentifier,
        assetId,
      );
    }

    if (!targets) {
      this.log.debug(`No profile for this channel and asset, falling back to default profile`); 
      targets = await this.configService.getDefaultRebalanceProfile(assetId);
    }

    if (!targets) {
      throw new Error(
        `Node is not configured to rebalance asset ${assetId} for user ${userPublicIdentifier}`,
      );
    }
    this.log.debug(`Rebalancing target: ${stringify(targets)}`)
    return targets;
  }

  async addRebalanceProfileToChannel(
    userPublicIdentifier: string,
    profile: RebalanceProfileType,
  ): Promise<RebalanceProfile> {
    this.log.info(
      `addRebalanceProfileToChannel for ${userPublicIdentifier} with ${JSON.stringify(profile)}`,
    );
    const {
      assetId,
      lowerBoundCollateralize,
      upperBoundCollateralize,
      lowerBoundReclaim,
      upperBoundReclaim,
    } = profile;
    if (
      upperBoundCollateralize.lt(lowerBoundCollateralize) ||
      upperBoundReclaim.lt(lowerBoundReclaim)
    ) {
      throw new Error(
        `Rebalancing targets not properly configured: ${JSON.stringify({
          lowerBoundCollateralize,
          upperBoundCollateralize,
          lowerBoundReclaim,
          upperBoundReclaim,
        })}`,
      );
    }

    // reclaim targets cannot be less than collateralize targets, otherwise we get into a loop of
    // collateralize/reclaim
    if (lowerBoundReclaim.lt(upperBoundCollateralize)) {
      throw new Error(
        `Reclaim targets cannot be less than collateralize targets: ${JSON.stringify({
          lowerBoundCollateralize,
          upperBoundCollateralize,
          lowerBoundReclaim,
          upperBoundReclaim,
        })}`,
      );
    }

    const rebalanceProfile = new RebalanceProfile();
    rebalanceProfile.assetId = getAddress(assetId);
    rebalanceProfile.lowerBoundCollateralize = lowerBoundCollateralize;
    rebalanceProfile.upperBoundCollateralize = upperBoundCollateralize;
    rebalanceProfile.lowerBoundReclaim = lowerBoundReclaim;
    rebalanceProfile.upperBoundReclaim = upperBoundReclaim;
    const result = await this.channelRepository.addRebalanceProfileToChannel(
      userPublicIdentifier,
      rebalanceProfile,
    );
    this.log.info(
      `addRebalanceProfileToChannel for ${userPublicIdentifier} complete: ${JSON.stringify(
        result,
      )}`,
    );
    return result;
  }

  /**
   * Creates a channel in the database with data from CF core event CREATE_CHANNEL
   * and marks it as available
   * @param creationData event data
   */
  async makeAvailable(creationData: CreateChannelMessage): Promise<void> {
    this.log.info(`makeAvailable ${JSON.stringify(creationData)} start`);
    const existing = await this.channelRepository.findByMultisigAddress(
      creationData.data.multisigAddress,
    );
    if (!existing) {
      throw new Error(
        `Did not find existing channel, meaning "PERSIST_STATE_CHANNEL" failed in setup protocol`,
      );
    }
    if (
      !creationData.data.owners.includes(
        getSignerAddressFromPublicIdentifier(existing.nodeIdentifier),
      ) ||
      !creationData.data.owners.includes(
        getSignerAddressFromPublicIdentifier(existing.userIdentifier),
      )
    ) {
      throw new Error(
        `Channel has already been created with different owners! ${stringify(
          existing,
        )}. Event data: ${stringify(creationData)}`,
      );
    }
    if (existing.available) {
      this.log.debug(`Channel is already available, doing nothing`);
      return;
    }
    this.log.debug(`Channel already exists in database, marking as available`);
    existing.available = true;
    await this.channelRepository.save(existing);
    this.log.info(`makeAvailable ${JSON.stringify(creationData)} complete`);
  }

  async getDataFromRebalancingService(
    userPublicIdentifier: string,
    assetId: string,
  ): Promise<RebalancingTargetsResponse<BigNumber> | undefined> {
    this.log.info(
      `getDataFromRebalancingService for ${userPublicIdentifier} asset ${assetId} start`,
    );
    const rebalancingServiceUrl = this.configService.getRebalancingServiceUrl();
    if (!rebalancingServiceUrl) {
      this.log.info(`Rebalancing service URL not configured for ${userPublicIdentifier}`);
      return undefined;
    }

    const hashedPublicIdentifier = sha256(toUtf8Bytes(userPublicIdentifier));
    const {
      data: rebalancingTargets,
      status,
    }: AxiosResponse<RebalancingTargetsResponse<string>> = await this.httpService
      .get(
        `${rebalancingServiceUrl}/api/v1/recommendations/asset/${assetId}/channel/${hashedPublicIdentifier}`,
      )
      .toPromise();

    if (status !== 200) {
      this.log.warn(
        `Rebalancing service returned a non-200 response for ${userPublicIdentifier}: ${status}`,
      );
      return undefined;
    }
    const response: RebalancingTargetsResponse<BigNumber> = {
      assetId: rebalancingTargets.assetId,
      lowerBoundCollateralize: bigNumberify(rebalancingTargets.lowerBoundCollateralize),
      upperBoundCollateralize: bigNumberify(rebalancingTargets.upperBoundCollateralize),
      lowerBoundReclaim: bigNumberify(rebalancingTargets.lowerBoundReclaim),
      upperBoundReclaim: bigNumberify(rebalancingTargets.upperBoundReclaim),
    };
    this.log.info(
      `getDataFromRebalancingService for ${userPublicIdentifier} asset ${assetId} complete: ${JSON.stringify(
        response,
      )}`,
    );
    return response;
  }

  async getRebalanceProfileForChannelAndAsset(
    userIdentifier: string,
    assetId: string = AddressZero,
  ): Promise<RebalanceProfile | undefined> {
    // try to get rebalance profile configured
    let profile = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
      userIdentifier,
      assetId,
    );
    return profile;
  }

  async getStateChannel(userIdentifier: string): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userIdentifier ${userIdentifier}`);
    }
    const { data: state } = await this.cfCoreService.getStateChannel(channel.multisigAddress);

    return state;
  }

  async getStateChannelByMultisig(multisigAddress: string): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisigAddress ${multisigAddress}`);
    }
    const { data: state } = await this.cfCoreService.getStateChannel(multisigAddress);

    return state;
  }

  async getAllChannels(): Promise<Channel[]> {
    const channels = await this.channelRepository.findAll();
    if (!channels) {
      throw new Error(`No channels found. This should never happen`);
    }
    return channels;
  }
}
