import {
  CreateChannelMessage,
  MethodResults,
  NodeResponses,
  RebalanceProfile as RebalanceProfileType,
  StateChannelJSON,
} from "@connext/types";
import { ERC20 } from "@connext/contracts";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable, HttpService } from "@nestjs/common";
import { AxiosResponse } from "axios";
import { BigNumber, providers, constants, utils, Contract } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { DepositService } from "../deposit/deposit.service";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { DEFAULT_DECIMALS } from "../constants";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

const { AddressZero } = constants;
const { getAddress, toUtf8Bytes, sha256, formatUnits } = utils;

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
    rebalanceType: RebalanceType,
  ): Promise<providers.TransactionReceipt | undefined> {
    this.log.info(
      `Rebalance type ${rebalanceType} for ${channel.userIdentifier} asset ${assetId} started`,
    );
    const normalizedAssetId = getAddress(assetId);
    if (channel.activeCollateralizations[assetId]) {
      this.log.warn(
        `Channel has collateralization in flight for ${normalizedAssetId}, doing nothing`,
      );
      return undefined;
    }

    const rebalancingTargets = await this.getRebalancingTargets(
      channel.userIdentifier,
      normalizedAssetId,
    );

    const { collateralizeThreshold, target, reclaimThreshold } = rebalancingTargets;

    if (
      (collateralizeThreshold.gt(target) || reclaimThreshold.lt(target)) &&
      !reclaimThreshold.isZero()
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

    let receipt: providers.TransactionReceipt;
    if (rebalanceType === RebalanceType.COLLATERALIZE) {
      // If free balance is too low, collateralize up to upper bound
      if (nodeFreeBalance.lt(collateralizeThreshold)) {
        this.log.info(
          `nodeFreeBalance ${nodeFreeBalance.toString()} < collateralizeThreshold ${collateralizeThreshold.toString()}, depositing`,
        );
        const amount = target.sub(nodeFreeBalance);
        receipt = await this.depositService.deposit(channel, amount, normalizedAssetId);
      } else {
        this.log.debug(
          `Free balance ${nodeFreeBalance} is greater than or equal to lower collateralization bound: ${collateralizeThreshold.toString()}`,
        );
      }
    }

    if (rebalanceType === RebalanceType.RECLAIM) {
      // If free balance is too high, reclaim down to lower bound
      if (nodeFreeBalance.gt(reclaimThreshold) && reclaimThreshold.gt(0)) {
        this.log.info(
          `nodeFreeBalance ${nodeFreeBalance.toString()} > reclaimThreshold ${reclaimThreshold.toString()}, withdrawing`,
        );
        const amount = nodeFreeBalance.sub(target);
        await this.withdrawService.withdraw(channel, amount, normalizedAssetId);
      } else {
        this.log.debug(
          `Free balance ${nodeFreeBalance} is less than or equal to upper reclaim bound: ${reclaimThreshold.toString()}`,
        );
      }
    }
    this.log.info(`Rebalance finished for ${channel.userIdentifier}, assetId: ${assetId}`);
    return receipt as providers.TransactionReceipt | undefined;
  }

  async getCollateralAmountToCoverPaymentAndRebalance(
    userPublicIdentifier: string,
    assetId: string,
    paymentAmount: BigNumber,
    currentBalance: BigNumber,
  ): Promise<BigNumber> {
    const { collateralizeThreshold, target } = await this.getRebalancingTargets(
      userPublicIdentifier,
      assetId,
    );
    // if the payment reduces the nodes current balance to below the lower
    // collateral bound, then on the next uninstall the node will try to
    // deposit again
    const resultingBalance = currentBalance.sub(paymentAmount);
    if (resultingBalance.lte(target)) {
      // return proper amount for balance to be the collateral limit
      // after the payment is performed
      return collateralizeThreshold.add(paymentAmount).sub(currentBalance);
    }
    // always default to the greater collateral value
    return paymentAmount.gt(collateralizeThreshold)
      ? paymentAmount.sub(currentBalance)
      : collateralizeThreshold.sub(currentBalance);
  }

  async getRebalancingTargets(
    userPublicIdentifier: string,
    assetId: string = AddressZero,
  ): Promise<RebalanceProfileType> {
    this.log.debug(
      `Getting rebalancing targets for user: ${userPublicIdentifier}, assetId: ${assetId}`,
    );
    let targets: RebalanceProfileType;
    // option 1: rebalancing service, option 2: rebalance profile, option 3: default
    targets = await this.getDataFromRebalancingService(userPublicIdentifier, assetId);

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

    // convert targets to proper units for token
    if (assetId !== AddressZero) {
      const token = new Contract(assetId, ERC20.abi, this.configService.getEthProvider());
      let decimals = DEFAULT_DECIMALS;
      try {
        decimals = await token.decimals();
      } catch (e) {
        this.log.error(
          `Could not retrieve decimals from token, proceeding with decimals = 18... Error: ${e.message}`,
        );
      }
      if (decimals !== DEFAULT_DECIMALS) {
        this.log.warn(
          `Token has ${decimals} decimals, converting rebalance targets. Pre-conversion: ${stringify(
            targets,
          )}`,
        );
        targets.collateralizeThreshold = BigNumber.from(
          formatUnits(targets.collateralizeThreshold, decimals).split(".")[0],
        );
        targets.target = BigNumber.from(formatUnits(targets.target, decimals).split(".")[0]);
        targets.reclaimThreshold = BigNumber.from(
          formatUnits(targets.reclaimThreshold, decimals).split(".")[0],
        );
        this.log.warn(`Converted rebalance targets: ${stringify(targets)}`);
      }
    }
    this.log.debug(`Rebalancing target: ${stringify(targets)}`);
    return targets;
  }

  async addRebalanceProfileToChannel(
    userPublicIdentifier: string,
    profile: RebalanceProfileType,
  ): Promise<RebalanceProfile> {
    this.log.info(
      `addRebalanceProfileToChannel for ${userPublicIdentifier} with ${stringify(profile)}`,
    );
    const { assetId, collateralizeThreshold, target, reclaimThreshold } = profile;
    if (reclaimThreshold.lt(target) || collateralizeThreshold.gt(target)) {
      throw new Error(`Rebalancing targets not properly configured: ${stringify(profile)}`);
    }

    // reclaim targets cannot be less than collateralize targets, otherwise we get into a loop of
    // collateralize/reclaim
    if (reclaimThreshold.lt(collateralizeThreshold)) {
      throw new Error(
        `Reclaim targets cannot be less than collateralize targets: ${stringify(profile)}`,
      );
    }

    const rebalanceProfile = new RebalanceProfile();
    rebalanceProfile.assetId = getAddress(assetId);
    rebalanceProfile.collateralizeThreshold = collateralizeThreshold;
    rebalanceProfile.target = target;
    rebalanceProfile.reclaimThreshold = reclaimThreshold;
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
    const existingOwners = [
      getSignerAddressFromPublicIdentifier(existing.nodeIdentifier),
      getSignerAddressFromPublicIdentifier(existing.userIdentifier),
    ];
    if (!existing) {
      throw new Error(
        `Did not find existing channel, meaning "PERSIST_STATE_CHANNEL" failed in setup protocol`,
      );
    }
    if (
      !creationData.data.owners.includes(existingOwners[0]) ||
      !creationData.data.owners.includes(existingOwners[1])
    ) {
      throw new Error(
        `Channel has already been created with owners ${stringify(
          existingOwners,
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
  ): Promise<RebalanceProfileType | undefined> {
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
    }: AxiosResponse<RebalanceProfileType> = await this.httpService
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
    const response: RebalanceProfileType = {
      assetId: rebalancingTargets.assetId,
      collateralizeThreshold: BigNumber.from(rebalancingTargets.collateralizeThreshold),
      target: BigNumber.from(rebalancingTargets.target),
      reclaimThreshold: BigNumber.from(rebalancingTargets.reclaimThreshold),
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
    const profile = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
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
