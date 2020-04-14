import { getSignerAddressFromPublicIdentifier } from "@connext/utils";
import {
  maxBN,
  MethodResults,
  NodeResponses,
  RebalanceProfile as RebalanceProfileType,
  StateChannelJSON,
  stringify,
} from "@connext/types";
import { Injectable, HttpService } from "@nestjs/common";
import { AxiosResponse } from "axios";
import { AddressZero, Zero } from "ethers/constants";
import { TransactionReceipt } from "ethers/providers";
import { BigNumber, getAddress, toUtf8Bytes, sha256, bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { DepositService } from "../deposit/deposit.service";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { CreateChannelMessage } from "../util/cfCore";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

type RebalancingTargetsResponse<T = string> = {
  assetId: string;
  upperBoundCollateralize: T;
  lowerBoundCollateralize: T;
  upperBoundReclaim: T;
  lowerBoundReclaim: T;
};

export enum RebalanceType {
  COLLATERALIZE,
  RECLAIM,
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
    return await this.channelRepository.findAll(available);
  }

  // NOTE: this is used by the `channel.provider`. if you use the
  // repository at that level, there is some ordering weirdness
  // where an empty array is returned from the query call, then
  // the provider method returns, and the query is *ACTUALLY* executed
  async getByUserPublicIdentifier(userIdentifier: string): Promise<NodeResponses.GetChannel | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userIdentifier);
    return (!channel || !channel.id) ? undefined : ({
      id: channel.id,
      available: channel.available,
      activeCollateralizations: channel.activeCollateralizations,
      multisigAddress: channel.multisigAddress,
      nodeIdentifier: channel.nodeIdentifier,
      userIdentifier: channel.userIdentifier,
    });
  }

  /**
   * Starts create channel process within CF core
   * @param counterpartyIdentifier
   */
  async create(counterpartyIdentifier: string): Promise<MethodResults.CreateChannel> {
    const existing = await this.channelRepository.findByUserPublicIdentifier(
      counterpartyIdentifier,
    );
    if (existing) {
      throw new Error(`Channel already exists for ${counterpartyIdentifier}`);
    }

    const createResult = await this.cfCoreService.createChannel(counterpartyIdentifier);
    return createResult;
  }

  async rebalance(
    userPubId: string,
    tokenAddress: string = AddressZero,
    rebalanceType: RebalanceType,
    minimumRequiredCollateral: BigNumber = Zero,
  ): Promise<TransactionReceipt | undefined> {
    const normalizedAssetId = getAddress(tokenAddress);
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(userPubId);

    // option 1: rebalancing service, option 2: rebalance profile, option 3: default
    let rebalancingTargets = await this.getDataFromRebalancingService(userPubId, tokenAddress);
    if (!rebalancingTargets) {
      this.log.debug(`Unable to get rebalancing targets from service, falling back to profile`);
      rebalancingTargets = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
        userPubId,
        normalizedAssetId,
      );
      if (!rebalancingTargets) {
        rebalancingTargets = await this.configService.getDefaultRebalanceProfile(tokenAddress);
        if (rebalancingTargets) {
          this.log.debug(`Rebalancing with default profile: ${stringify(rebalancingTargets)}`);
        }
      }
    }

    if (!rebalancingTargets) {
      throw new Error(`Node is not configured to rebalance asset ${tokenAddress} for user ${userPubId}`);
    }

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
    if (rebalanceType === RebalanceType.COLLATERALIZE) {
      // if minimum amount is larger, override upper bound
      const collateralNeeded: BigNumber = maxBN([
        upperBoundCollateralize,
        minimumRequiredCollateral,
      ]);
      return this.collateralizeIfNecessary(
        channel,
        tokenAddress,
        collateralNeeded,
        lowerBoundCollateralize,
      );
    } else if (rebalanceType === RebalanceType.RECLAIM) {
      await this.reclaimIfNecessary(
        channel,
        tokenAddress,
        upperBoundReclaim,
        lowerBoundReclaim,
      );
      return undefined;
    } else {
      throw new Error(`Invalid rebalancing type: ${rebalanceType}`);
    }
  }

  private async collateralizeIfNecessary(
    channel: Channel,
    assetId: string,
    collateralNeeded: BigNumber,
    lowerBoundCollateral: BigNumber,
  ): Promise<TransactionReceipt | undefined> {
    if (channel.activeCollateralizations[assetId]) {
      this.log.warn(
        `Collateral request is in flight for ${assetId}, try request again for user ${channel.userIdentifier} later`,
      );
      return undefined;
    }

    const {
      [this.cfCoreService.cfCore.signerAddress]: nodeFreeBalance,
    } = await this.cfCoreService.getFreeBalance(
      channel.userIdentifier,
      channel.multisigAddress,
      assetId,
    );
    if (nodeFreeBalance.gte(lowerBoundCollateral)) {
      this.log.debug(
        `User ${channel.userIdentifier} already has collateral of ${nodeFreeBalance} for asset ${assetId}`,
      );
      return undefined;
    }

    const amountDeposit = collateralNeeded.sub(nodeFreeBalance);
    this.log.warn(
      `Collateralizing ${channel.userIdentifier} with ${amountDeposit}, token: ${assetId}`,
    );

    // set in flight so that it cant be double sent
    this.log.debug(`Collateralizing ${channel.multisigAddress} with ${amountDeposit.toString()} of ${assetId}`);
    await this.setCollateralizationInFlight(channel.multisigAddress, assetId);
    let receipt: TransactionReceipt | undefined = undefined;
    try {
      receipt = await this.depositService.deposit(channel, amountDeposit, assetId);
      this.log.info(`Channel ${channel.multisigAddress} successfully collateralized: ${receipt.transactionHash}`);
      this.log.debug(`Collateralization result: ${stringify(receipt)}`);
    } catch (e) {
      throw new Error(e.stack || e.message);
    } finally {
      await this.clearCollateralizationInFlight(channel.multisigAddress, assetId);
    }
    return receipt;
  }

  // collateral is reclaimed if it is above the upper bound
  private async reclaimIfNecessary(
    channel: Channel,
    assetId: string,
    upperBoundReclaim: BigNumber,
    lowerBoundReclaim: BigNumber,
  ): Promise<void> {
    if (upperBoundReclaim.isZero() && lowerBoundReclaim.isZero()) {
      this.log.info(
        `Collateral for channel ${channel.multisigAddress} is within bounds, nothing to reclaim.`,
      );
      return undefined;
    }
    const {
      [this.cfCoreService.cfCore.signerAddress]: nodeFreeBalance,
    } = await this.cfCoreService.getFreeBalance(
      channel.userIdentifier,
      channel.multisigAddress,
      assetId,
    );
    if (nodeFreeBalance.lte(upperBoundReclaim)) {
      this.log.info(
        `Collateral for channel ${channel.multisigAddress} is below upper bound, nothing to reclaim.`,
      );
      this.log.debug(
        `Node has balance of ${nodeFreeBalance} for asset ${assetId} in channel with user ${channel.userIdentifier}`,
      );
      return undefined;
    }

    // example:
    // freeBalance = 10
    // upperBound = 8
    // lowerBound = 6
    // amountWithdrawal = freeBalance - lowerBound = 10 - 6 = 4
    const amountWithdrawal = nodeFreeBalance.sub(lowerBoundReclaim);
    this.log.info(`Reclaiming collateral from channel ${channel.multisigAddress}`);
    this.log.debug(
      `Reclaiming ${channel.multisigAddress}, ${amountWithdrawal.toString()}, token: ${assetId}`,
    );

    await this.withdrawService.withdraw(channel, amountWithdrawal, assetId);
  }

  async clearCollateralizationInFlight(multisigAddress: string, assetId: string): Promise<Channel> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisig ${multisigAddress}`);
    }

    return await this.channelRepository.setInflightCollateralization(channel, assetId, false);
  }

  async setCollateralizationInFlight(multisigAddress: string, assetId: string): Promise<Channel> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisig ${multisigAddress}`);
    }

    return await this.channelRepository.setInflightCollateralization(channel, assetId, true);
  }

  async addRebalanceProfileToChannel(
    userPubId: string,
    profile: RebalanceProfileType,
  ): Promise<RebalanceProfile> {
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
    return await this.channelRepository.addRebalanceProfileToChannel(userPubId, rebalanceProfile);
  }

  /**
   * Creates a channel in the database with data from CF core event CREATE_CHANNEL
   * and marks it as available
   * @param creationData event data
   */
  async makeAvailable(creationData: CreateChannelMessage): Promise<void> {
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
  }

  async getDataFromRebalancingService(
    userIdentifier: string,
    assetId: string,
  ): Promise<RebalancingTargetsResponse<BigNumber> | undefined> {
    const rebalancingServiceUrl = this.configService.getRebalancingServiceUrl();
    if (!rebalancingServiceUrl) {
      this.log.debug(`Rebalancing service URL not configured`);
      return undefined;
    }

    const hashedPublicIdentifier = sha256(toUtf8Bytes(userIdentifier));
    const {
      data: rebalancingTargets,
      status,
    }: AxiosResponse<RebalancingTargetsResponse<string>> = await this.httpService
      .get(
        `${rebalancingServiceUrl}/api/v1/recommendations/asset/${assetId}/channel/${hashedPublicIdentifier}`,
      )
      .toPromise();

    if (status !== 200) {
      this.log.warn(`Rebalancing service returned a non-200 response: ${status}`);
      return undefined;
    }
    return {
      assetId: rebalancingTargets.assetId,
      lowerBoundCollateralize: bigNumberify(rebalancingTargets.lowerBoundCollateralize),
      upperBoundCollateralize: bigNumberify(rebalancingTargets.upperBoundCollateralize),
      lowerBoundReclaim: bigNumberify(rebalancingTargets.lowerBoundReclaim),
      upperBoundReclaim: bigNumberify(rebalancingTargets.upperBoundReclaim),
    };
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
