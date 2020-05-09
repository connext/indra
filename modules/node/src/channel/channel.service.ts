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
import { TransactionReceipt } from "ethers/providers";
import { BigNumber, getAddress, toUtf8Bytes, sha256, bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { DepositService } from "../deposit/deposit.service";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";

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

  async rebalance(
    userPublicIdentifier: string,
    assetId: string = AddressZero,
  ): Promise<TransactionReceipt | undefined> {
    this.log.info(
      `rebalance for ${userPublicIdentifier} asset ${assetId} started`,
    );
    const normalizedAssetId = getAddress(assetId);
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      userPublicIdentifier,
    );

    const rebalancingTargets = await this.getRebalancingTargets(
      userPublicIdentifier,
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
    let result: TransactionReceipt;
    if (rebalanceType === RebalanceType.COLLATERALIZE) {
      // if minimum amount is larger, override upper bound
      const collateralNeeded: BigNumber = maxBN([
        upperBoundCollateralize,
        minimumRequiredCollateral,
      ]);
      result = await this.collateralizeIfNecessary(
        channel.userIdentifier,
        assetId,
        collateralNeeded,
        lowerBoundCollateralize,
      );
    } else if (rebalanceType === RebalanceType.RECLAIM) {
      await this.reclaimIfNecessary(channel, assetId, upperBoundReclaim, lowerBoundReclaim);
    } else {
      throw new Error(`Invalid rebalancing type: ${rebalanceType}`);
    }

    return result;
  }

  private async collateralizeIfNecessary(
    userId: string,
    assetId: string,
    collateralNeeded: BigNumber,
    lowerBoundCollateral: BigNumber,
  ): Promise<TransactionReceipt | undefined> {
    this.log.info(
      `collateralizeIfNecessary started: ${stringify({
        userId,
        assetId,
        collateralNeeded,
        lowerBoundCollateral,
      })}`,
    );
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(userId);
    if (channel.activeCollateralizations[assetId]) {
      this.log.warn(`Collateral request is in flight for ${assetId}, waiting for transaction`);
      const ethProvider = this.configService.getEthProvider();
      const startingBlock = await ethProvider.getBlockNumber();
      // register listener
      const depositReceipt: TransactionReceipt = await new Promise(async resolve => {
        const BLOCKS_TO_WAIT = 3;
        ethProvider.on("block", async (blockNumber: number) => {
          if (blockNumber - startingBlock > BLOCKS_TO_WAIT) {
            return resolve(undefined);
          }
          const { transactions } = await ethProvider.getBlock(blockNumber);
          for (const hash of transactions) {
            const tx = await this.depositService.findByHash(hash);
            if (
              tx &&
              tx.channel.userIdentifier === userId &&
              tx.from === (await this.configService.getSignerAddress())
            ) {
              this.log.info(`Found deposit transaction: ${hash}`);
              return resolve(await ethProvider.getTransactionReceipt(hash));
            }
          }
        });
      });
      return depositReceipt;
    }

    const {
      [this.cfCoreService.cfCore.signerAddress]: nodeFreeBalance,
    } = await this.cfCoreService.getFreeBalance(
      channel.userIdentifier,
      channel.multisigAddress,
      assetId,
    );
    if (nodeFreeBalance.gte(lowerBoundCollateral)) {
      this.log.info(
        `Collateral for user ${channel.userIdentifier} is within bounds, nothing to collateralize`,
      );
      return undefined;
    }

    const amountDeposit = collateralNeeded.sub(nodeFreeBalance);
    this.log.info(
      `Collateralizing ${channel.userIdentifier} with ${amountDeposit}, token: ${assetId}`,
    );

    // set in flight so that it cant be double sent
    await this.setCollateralizationInFlight(channel.multisigAddress, assetId);
    let receipt: TransactionReceipt | undefined = undefined;
    try {
      receipt = await this.depositService.deposit(channel, amountDeposit, assetId);
      this.log.info(
        `Collateralization for ${channel.multisigAddress}, asset ${assetId} complete: ${stringify(
          receipt,
        )}`,
      );
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

    return this.channelRepository.setInflightCollateralization(channel, assetId, false);
  }

  async setCollateralizationInFlight(multisigAddress: string, assetId: string): Promise<Channel> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisig ${multisigAddress}`);
    }

    return this.channelRepository.setInflightCollateralization(channel, assetId, true);
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
