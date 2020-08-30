import {
  CreateChannelMessage,
  MethodResults,
  NodeResponses,
  RebalanceProfile as RebalanceProfileType,
  StateChannelJSON,
  DepositAppName,
  DepositAppState,
  FreeBalanceResponse,
} from "@connext/types";
import {
  getSignerAddressFromPublicIdentifier,
  stringify,
  calculateExchangeWad,
  maxBN,
} from "@connext/utils";
import { Injectable, HttpService } from "@nestjs/common";
import { AxiosResponse } from "axios";
import { BigNumber, constants, utils, providers } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { DepositService } from "../deposit/deposit.service";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { DEFAULT_DECIMALS } from "../constants";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

const { AddressZero, Zero } = constants;
const { getAddress, toUtf8Bytes, sha256 } = utils;

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
    chainId: number,
  ): Promise<NodeResponses.GetChannel | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifierAndChain(
      userIdentifier,
      chainId,
    );
    this.log.debug(`Got channel for ${userIdentifier}: ${stringify(channel, true)}`);
    return !channel || !channel.multisigAddress
      ? undefined
      : {
          available: channel.available,
          multisigAddress: channel.multisigAddress,
          nodeIdentifier: channel.nodeIdentifier,
          userIdentifier: channel.userIdentifier,
        };
  }

  /**
   * Starts create channel process within CF core
   * @param counterpartyIdentifier
   */
  async create(
    counterpartyIdentifier: string,
    chainId: number,
  ): Promise<MethodResults.CreateChannel> {
    this.log.info(`create ${counterpartyIdentifier} started`);
    const existing = await this.channelRepository.findByUserPublicIdentifierAndChain(
      counterpartyIdentifier,
      chainId,
    );
    if (existing) {
      throw new Error(
        `Channel already exists for ${counterpartyIdentifier} on ${chainId}: ${existing.multisigAddress}`,
      );
    }

    const createResult = await this.cfCoreService.createChannel(counterpartyIdentifier, chainId);
    this.log.info(
      `create ${counterpartyIdentifier} on ${chainId} finished: ${JSON.stringify(createResult)}`,
    );
    return createResult;
  }

  async rebalance(
    multisigAddress: string,
    assetId: string = AddressZero,
    rebalanceType: RebalanceType,
    requestedTarget: BigNumber = Zero,
  ): Promise<
    | {
        completed?: () => Promise<FreeBalanceResponse>;
        transaction?: providers.TransactionResponse;
        appIdentityHash?: string;
      }
    | undefined
  > {
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    this.log.info(
      `Rebalance type ${rebalanceType} for ${channel.userIdentifier} asset ${assetId} started on chain ${channel.chainId} for ${multisigAddress}`,
    );
    const normalizedAssetId = getAddress(assetId);
    const depositApps = await this.cfCoreService.getAppInstancesByAppDefinition(
      multisigAddress,
      this.cfCoreService.getAppInfoByNameAndChain(DepositAppName, channel.chainId)!
        .appDefinitionAddress,
    );
    const signerAddr = await this.configService.getSignerAddress();
    const ours = depositApps.find((app) => {
      const latestState = app.latestState as DepositAppState;
      return (
        latestState.assetId === normalizedAssetId && latestState.transfers[0].to === signerAddr
      );
    });
    if (ours && rebalanceType === RebalanceType.COLLATERALIZE) {
      this.log.warn(
        `Channel ${channel.multisigAddress} has collateralization in flight for ${normalizedAssetId} on chain ${channel.chainId}, doing nothing. App: ${ours.identityHash}`,
      );
      return undefined;
    }

    const rebalancingTargets = await this.getRebalancingTargets(
      channel.userIdentifier,
      channel.chainId,
      normalizedAssetId,
    );

    const { collateralizeThreshold, target: profileTarget, reclaimThreshold } = rebalancingTargets;

    if (
      (collateralizeThreshold.gt(profileTarget) || reclaimThreshold.lt(profileTarget)) &&
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

    let rebalanceRes: {
      completed?: () => Promise<FreeBalanceResponse>;
      transaction?: providers.TransactionResponse;
      appIdentityHash?: string;
    } = {};

    if (rebalanceType === RebalanceType.COLLATERALIZE) {
      // If free balance is too low, collateralize up to upper bound

      // make sure requested target is under reclaim threshold
      if (requestedTarget?.gt(reclaimThreshold)) {
        throw new Error(
          `Requested target ${requestedTarget.toString()} is greater than reclaim threshold ${reclaimThreshold.toString()}`,
        );
      }

      const targetToUse = maxBN([profileTarget, requestedTarget]);
      const thresholdToUse = maxBN([collateralizeThreshold, requestedTarget]);

      if (nodeFreeBalance.lt(thresholdToUse)) {
        this.log.info(
          `nodeFreeBalance ${nodeFreeBalance.toString()} < thresholdToUse ${thresholdToUse.toString()}, depositing to target ${requestedTarget.toString()}`,
        );
        const amount = targetToUse.sub(nodeFreeBalance);
        rebalanceRes = (await this.depositService.deposit(channel, amount, normalizedAssetId))!;
      } else {
        this.log.info(
          `Free balance ${nodeFreeBalance} is greater than or equal to lower collateralization bound: ${thresholdToUse.toString()}`,
        );
      }
    } else if (rebalanceType === RebalanceType.RECLAIM) {
      // If free balance is too high, reclaim down to lower bound
      if (nodeFreeBalance.gt(reclaimThreshold) && reclaimThreshold.gt(0)) {
        this.log.info(
          `nodeFreeBalance ${nodeFreeBalance.toString()} > reclaimThreshold ${reclaimThreshold.toString()}, withdrawing`,
        );
        const amount = nodeFreeBalance.sub(profileTarget);
        const transaction = await this.withdrawService.withdraw(channel, amount, normalizedAssetId);
        rebalanceRes.transaction = transaction;
      } else {
        this.log.info(
          `Free balance ${nodeFreeBalance} is less than or equal to upper reclaim bound: ${reclaimThreshold.toString()}`,
        );
      }
    }
    this.log.info(
      `Rebalance finished for ${channel.userIdentifier} on chain ${channel.chainId}, assetId: ${assetId}`,
    );
    return rebalanceRes;
  }

  async getCollateralAmountToCoverPaymentAndRebalance(
    userPublicIdentifier: string,
    chainId: number,
    assetId: string,
    paymentAmount: BigNumber,
    currentBalance: BigNumber,
  ): Promise<BigNumber> {
    const { collateralizeThreshold, target } = await this.getRebalancingTargets(
      userPublicIdentifier,
      chainId,
      assetId,
    );
    // if the payment reduces the nodes current balance to below the lower
    // collateral bound, then on the next uninstall the node will try to
    // deposit again
    const resultingBalance = currentBalance.sub(paymentAmount);
    if (resultingBalance.lte(target)) {
      const requiredAmount = collateralizeThreshold.add(paymentAmount).sub(currentBalance);
      this.log.warn(`Need extra collateral to cover payment: ${requiredAmount.toString()}`);
      // return proper amount for balance to be the collateral limit
      // after the payment is performed
      return requiredAmount;
    }
    // always default to the greater collateral value
    return paymentAmount.gt(collateralizeThreshold)
      ? paymentAmount.sub(currentBalance)
      : collateralizeThreshold.sub(currentBalance);
  }

  async getRebalancingTargets(
    userPublicIdentifier: string,
    chainId: number,
    assetId: string = AddressZero,
  ): Promise<RebalanceProfileType> {
    this.log.debug(
      `Getting rebalancing targets for user: ${userPublicIdentifier} on ${chainId}, assetId: ${assetId}`,
    );
    let targets: RebalanceProfileType | undefined;
    // option 1: rebalancing service, option 2: rebalance profile, option 3: default
    targets = await this.getDataFromRebalancingService(userPublicIdentifier, assetId);

    if (!targets) {
      this.log.debug(`Unable to get rebalancing targets from service, falling back to profile`);
      targets = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
        userPublicIdentifier,
        chainId,
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
      const decimals = await this.configService.getTokenDecimals(chainId, assetId);
      if (decimals !== DEFAULT_DECIMALS) {
        this.log.info(`Token has ${decimals} decimals, converting rebalance targets`);
        targets.collateralizeThreshold = calculateExchangeWad(
          targets.collateralizeThreshold,
          DEFAULT_DECIMALS,
          "1",
          decimals,
        );
        targets.target = calculateExchangeWad(targets.target, DEFAULT_DECIMALS, "1", decimals);
        targets.reclaimThreshold = calculateExchangeWad(
          targets.reclaimThreshold,
          DEFAULT_DECIMALS,
          "1",
          decimals,
        );
        this.log.warn(`Converted rebalance targets: ${stringify(targets)}`);
      }
    }
    this.log.info(`Rebalancing target for ${assetId} on ${chainId}: ${stringify(targets)}`);
    return targets;
  }

  async addRebalanceProfileToChannel(
    userPublicIdentifier: string,
    chainId: number,
    profile: RebalanceProfileType,
  ): Promise<RebalanceProfile> {
    this.log.info(
      `addRebalanceProfileToChannel for ${userPublicIdentifier} on ${chainId} with ${stringify(
        profile,
        false,
        0,
      )}`,
    );
    const { assetId, collateralizeThreshold, target, reclaimThreshold } = profile;
    if (
      (!reclaimThreshold.isZero() && reclaimThreshold.lt(target)) ||
      collateralizeThreshold.gt(target)
    ) {
      throw new Error(`Rebalancing targets not properly configured: ${stringify(profile)}`);
    }

    // reclaim targets cannot be less than collateralize targets, otherwise we get into a loop of
    // collateralize/reclaim
    if (!reclaimThreshold.isZero() && reclaimThreshold.lt(collateralizeThreshold)) {
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
      chainId,
      rebalanceProfile,
    );
    this.log.info(
      `addRebalanceProfileToChannel for ${userPublicIdentifier} on ${chainId} complete: ${stringify(
        result,
        false,
        0,
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
    const existingOwners = [
      getSignerAddressFromPublicIdentifier(existing!.nodeIdentifier),
      getSignerAddressFromPublicIdentifier(existing!.userIdentifier),
    ];
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
    chainId: number,
    assetId: string = AddressZero,
  ): Promise<RebalanceProfile | undefined> {
    // try to get rebalance profile configured
    const profile = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
      userIdentifier,
      chainId,
      assetId,
    );
    return profile;
  }

  async getStateChannel(userIdentifier: string, chainId: number): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByUserPublicIdentifierAndChainOrThrow(
      userIdentifier,
      chainId,
    );
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
