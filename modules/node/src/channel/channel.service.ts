import {
  ChannelAppSequences,
  StateChannelJSON,
  CoinBalanceRefundApp,
  maxBN,
  RebalanceProfileBigNumber,
} from "@connext/types";
import { Injectable, HttpService, Inject } from "@nestjs/common";
import { AxiosResponse } from "axios";
import { Contract } from "ethers";
import { AddressZero, HashZero, Zero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { BigNumber, getAddress, toUtf8Bytes, sha256, bigNumberify } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { MessagingClientProviderId } from "../constants";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { CLogger, stringify, xpubToAddress } from "../util";
import { CFCoreTypes, CreateChannelMessage } from "../util/cfCore";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";
import { ClientProxy } from "@nestjs/microservices";

const logger = new CLogger(`ChannelService`);

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
    private readonly configService: ConfigService,
    private readonly onchainTransactionService: OnchainTransactionService,
    private readonly httpService: HttpService,
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
    private readonly channelRepository: ChannelRepository,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
  ) {}

  /**
   * Returns all channel records.
   * @param available available value of channel
   */
  async findAll(available: boolean = true): Promise<Channel[]> {
    return await this.channelRepository.findAll(available);
  }

  /**
   * Starts create channel process within CF core
   * @param counterpartyPublicIdentifier
   */
  async create(counterpartyPublicIdentifier: string): Promise<CFCoreTypes.CreateChannelResult> {
    const existing = await this.channelRepository.findByUserPublicIdentifier(counterpartyPublicIdentifier);
    if (existing) {
      throw new Error(`Channel already exists for ${counterpartyPublicIdentifier}`);
    }

    return await this.cfCoreService.createChannel(counterpartyPublicIdentifier);
  }

  private async deposit(
    multisigAddress: string,
    amount: BigNumber,
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.DepositResult> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisigAddress ${multisigAddress}`);
    }

    // don't allow deposit if user's balance refund app is installed
    const balanceRefundApp = await this.cfCoreService.getCoinBalanceRefundApp(multisigAddress, assetId);
    if (balanceRefundApp && balanceRefundApp.latestState[`recipient`] === xpubToAddress(channel.userPublicIdentifier)) {
      throw new Error(`Cannot deposit, user's CoinBalanceRefundApp is installed for ${channel.userPublicIdentifier}`);
    }

    if (
      balanceRefundApp &&
      balanceRefundApp.latestState[`recipient`] === this.cfCoreService.cfCore.freeBalanceAddress
    ) {
      logger.log(`Node's CoinBalanceRefundApp is installed, removing first.`);
      await this.cfCoreService.rescindDepositRights(channel.multisigAddress, assetId);
    }

    await this.proposeCoinBalanceRefund(assetId, channel);

    const res = await this.cfCoreService.deposit(multisigAddress, amount, getAddress(assetId));
    const depositTx = await this.configService.getEthProvider().getTransaction(res.transactionHash);
    await this.onchainTransactionRepository.addCollateralization(depositTx, channel);
    return res;
  }

  private async reclaim(
    channel: Channel,
    amount: BigNumber,
    assetId: string = AddressZero,
  ): Promise<TransactionResponse> {
    // don't allow withdraw if user's balance refund app is installed
    const balanceRefundApp = await this.cfCoreService.getCoinBalanceRefundApp(channel.multisigAddress, assetId);
    if (balanceRefundApp && balanceRefundApp.latestState[`recipient`] === xpubToAddress(channel.userPublicIdentifier)) {
      throw new Error(`Cannot withdraw, user's CoinBalanceRefundApp is installed for ${channel.userPublicIdentifier}`);
    }

    if (
      balanceRefundApp &&
      balanceRefundApp.latestState[`recipient`] === this.cfCoreService.cfCore.freeBalanceAddress
    ) {
      logger.log(`Node's CoinBalanceRefundApp is installed, removing first.`);
      await this.cfCoreService.rescindDepositRights(channel.multisigAddress, assetId);
    }

    await this.proposeCoinBalanceRefund(assetId, channel);

    const res = await this.cfCoreService.generateWithdrawCommitment(
      channel.multisigAddress,
      amount,
      getAddress(assetId),
    );
    const tx = await this.onchainTransactionService.sendWithdrawalCommitment(channel, res.transaction);
    tx.wait().then(txReceipt => {
      this.messagingClient
        .emit(`indra.node.${this.cfCoreService.cfCore.publicIdentifier}.reclaim.${channel.multisigAddress}`, {
          amount: amount.toString(),
          assetId,
          status: txReceipt.status,
          transactionHash: txReceipt.transactionHash,
        })
        .toPromise();
    });
    return tx;
  }

  private async proposeCoinBalanceRefund(assetId: string, channel: Channel): Promise<void> {
    // any deposit has to first propose the balance refund app
    const ethProvider = this.configService.getEthProvider();
    const threshold =
      assetId === AddressZero
        ? await ethProvider.getBalance(channel.multisigAddress)
        : await new Contract(assetId!, tokenAbi, ethProvider).functions.balanceOf(channel.multisigAddress);

    const initialState = {
      multisig: channel.multisigAddress,
      recipient: this.cfCoreService.cfCore.freeBalanceAddress,
      threshold,
      tokenAddress: assetId,
    };

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = await this.configService.getDefaultAppByName(CoinBalanceRefundApp);

    const params: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: channel.userPublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    // propose install + wait for client confirmation
    await this.cfCoreService.proposeAndWaitForAccepted(params, channel.multisigAddress);
  }

  async rebalance(
    userPubId: string,
    assetId: string = AddressZero,
    rebalanceType: RebalanceType,
    minimumRequiredCollateral: BigNumber = Zero,
  ): Promise<TransactionResponse | undefined> {
    const normalizedAssetId = getAddress(assetId);
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);

    if (!channel) {
      throw new Error(`Channel does not exist for user ${userPubId}`);
    }

    // option 1: rebalancing service, option 2: rebalance profile, option 3: default
    let rebalancingTargets = await this.getDataFromRebalancingService(userPubId, assetId);
    if (!rebalancingTargets) {
      logger.log(`Unable to get rebalancing targets from service, falling back to profile`);
      rebalancingTargets = await this.getRebalanceProfileForChannelAndAsset(userPubId, normalizedAssetId);
      if (!rebalancingTargets) {
        rebalancingTargets = await this.configService.getDefaultRebalanceProfile(assetId);
        if (rebalancingTargets) {
          logger.debug(`Rebalancing with default profile: ${stringify(rebalancingTargets)}`);
        }
      }
    }

    if (!rebalancingTargets) {
      throw new Error(`Node is not configured to rebalance asset ${assetId} for user ${userPubId}`);
    }

    const {
      lowerBoundCollateralize,
      upperBoundCollateralize,
      lowerBoundReclaim,
      upperBoundReclaim,
    } = rebalancingTargets;

    if (upperBoundCollateralize.lt(lowerBoundCollateralize) || upperBoundReclaim.lt(lowerBoundReclaim)) {
      throw new Error(`Rebalancing targets not properly configured: ${rebalancingTargets}`);
    }
    if (rebalanceType === RebalanceType.COLLATERALIZE) {
      // if minimum amount is supplier, override upper bound
      const collateralNeeded: BigNumber = maxBN([upperBoundCollateralize, minimumRequiredCollateral]);
      const res = await this.collateralizeIfNecessary(channel, assetId, collateralNeeded, lowerBoundCollateralize);
      let txResponse: TransactionResponse;
      if (res) {
        txResponse = await this.configService.getEthProvider().getTransaction(res.transactionHash);
      }
      return txResponse;
    } else if (rebalanceType === RebalanceType.RECLAIM) {
      return await this.reclaimIfNecessary(channel, assetId, upperBoundReclaim, lowerBoundReclaim);
    } else {
      throw new Error(`Invalid rebalancing type: ${rebalanceType}`);
    }
  }

  private async collateralizeIfNecessary(
    channel: Channel,
    assetId: string,
    collateralNeeded: BigNumber,
    lowerBoundCollateral: BigNumber,
  ) {
    if (channel.collateralizationInFlight) {
      logger.warn(`Collateral request is in flight, try request again for user ${channel.userPublicIdentifier} later`);
      return undefined;
    }

    const { [this.cfCoreService.cfCore.freeBalanceAddress]: nodeFreeBalance } = await this.cfCoreService.getFreeBalance(
      channel.userPublicIdentifier,
      channel.multisigAddress,
      assetId,
    );
    if (nodeFreeBalance.gte(lowerBoundCollateral)) {
      logger.log(
        `${channel.userPublicIdentifier} already has sufficient collateral of ${nodeFreeBalance} for asset ${assetId}`,
      );
      return undefined;
    }

    const amountDeposit = collateralNeeded.sub(nodeFreeBalance);
    logger.log(`Collateralizing ${channel.multisigAddress} with ${amountDeposit.toString()}, token: ${assetId}`);

    // set in flight so that it cant be double sent
    await this.channelRepository.setInflightCollateralization(channel, true);
    const result = this.deposit(channel.multisigAddress, amountDeposit, assetId)
      .then(async (res: CFCoreTypes.DepositResult) => {
        logger.log(`Deposit result: ${stringify(res)}`);
        return res;
      })
      .catch(async (e: any) => {
        await this.clearCollateralizationInFlight(channel.multisigAddress);
        throw e;
      });
    return result;
  }

  // collateral is reclaimed if it is above the upper bound
  private async reclaimIfNecessary(
    channel: Channel,
    assetId: string,
    upperBoundReclaim: BigNumber,
    lowerBoundReclaim: BigNumber,
  ): Promise<TransactionResponse | undefined> {
    if (upperBoundReclaim.isZero() && lowerBoundReclaim.isZero()) {
      logger.log(`Upper bound and lower bound for reclaim are 0, doing nothing.`);
      return undefined;
    }
    const { [this.cfCoreService.cfCore.freeBalanceAddress]: nodeFreeBalance } = await this.cfCoreService.getFreeBalance(
      channel.userPublicIdentifier,
      channel.multisigAddress,
      assetId,
    );
    if (nodeFreeBalance.lte(upperBoundReclaim)) {
      logger.log(`${channel.multisigAddress} does not need to be reclaimed, ${nodeFreeBalance} for asset ${assetId}`);
      return undefined;
    }

    // example:
    // freeBalance = 10
    // upperBound = 8
    // lowerBound = 6
    // amountWithdrawal = freeBalance - lowerBound = 10 - 6 = 4
    const amountWithdrawal = nodeFreeBalance.sub(lowerBoundReclaim);
    logger.log(`Reclaiming ${channel.multisigAddress}, ${amountWithdrawal.toString()}, token: ${assetId}`);

    return await this.reclaim(channel, amountWithdrawal, assetId);
  }

  async clearCollateralizationInFlight(multisigAddress: string): Promise<Channel> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisig ${multisigAddress}`);
    }

    return await this.channelRepository.setInflightCollateralization(channel, false);
  }

  async addRebalanceProfileToChannel(userPubId: string, profile: RebalanceProfileBigNumber): Promise<RebalanceProfile> {
    const { assetId, lowerBoundCollateralize, upperBoundCollateralize, lowerBoundReclaim, upperBoundReclaim } = profile;
    if (upperBoundCollateralize.lt(lowerBoundCollateralize) || upperBoundReclaim.lt(lowerBoundReclaim)) {
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
    let existing = await this.channelRepository.findByMultisigAddress(creationData.data.multisigAddress);
    if (existing) {
      if (
        !creationData.data.owners.includes(xpubToAddress(existing.nodePublicIdentifier)) ||
        !creationData.data.owners.includes(xpubToAddress(existing.userPublicIdentifier))
      ) {
        throw new Error(
          `Channel has already been created with different owners! ${stringify(existing)}. Event data: ${stringify(
            creationData,
          )}`,
        );
      }
      if (existing.available) {
        logger.log(`Channel is already available, doing nothing`);
        return;
      }
      logger.log(`Channel already exists in database, marking as available`);
    } else {
      logger.log(`Creating new channel from data ${stringify(creationData)}`);
      existing = new Channel();
      existing.userPublicIdentifier = creationData.data.counterpartyXpub;
      existing.nodePublicIdentifier = this.cfCoreService.cfCore.publicIdentifier;
      existing.multisigAddress = creationData.data.multisigAddress;
    }
    existing.available = true;
    await this.channelRepository.save(existing);
  }

  /**
   * Returns the app sequence number of the node and the user
   *
   * @param userPublicIdentifier users xpub
   * @param userSequenceNumber sequence number provided by user
   */
  async verifyAppSequenceNumber(
    userPublicIdentifier: string,
    userSequenceNumber: number,
  ): Promise<ChannelAppSequences> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`Could not find channel associated with: ${userPublicIdentifier} in verifyAppSequenceNumber`);
    }
    const sc = (await this.cfCoreService.getStateChannel(channel.multisigAddress)).data;
    const [, appJson] = sc.appInstances.reduce((prev, curr) => {
      const [, prevJson] = prev;
      const [, currJson] = curr;
      return currJson.appSeqNo > prevJson.appSeqNo ? curr : prev;
    });
    const nodeSequenceNumber = appJson.appSeqNo;
    if (nodeSequenceNumber !== userSequenceNumber) {
      logger.warn(
        `Node app sequence number (${nodeSequenceNumber}) !== user app sequence number (${userSequenceNumber})`,
      );
    }
    return {
      nodeSequenceNumber,
      userSequenceNumber,
    };
  }

  async withdrawForClient(
    userPublicIdentifier: string,
    tx: CFCoreTypes.MinimalTransaction,
  ): Promise<TransactionResponse> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userPublicIdentifier ${userPublicIdentifier}`);
    }

    const { transactionHash: deployTx } = await this.cfCoreService.deployMultisig(channel.multisigAddress);
    logger.debug(`Deploy multisig tx: ${deployTx}`);

    const wallet = this.configService.getEthWallet();
    if (deployTx !== HashZero) {
      logger.debug(`Waiting for deployment transaction...`);
      wallet.provider.waitForTransaction(deployTx);
      logger.debug(`Deployment transaction complete!`);
    } else {
      logger.debug(`Multisig already deployed, proceeding with withdrawal`);
    }

    const txRes = await this.onchainTransactionService.sendUserWithdrawal(channel, tx);
    return txRes;
  }

  async getDataFromRebalancingService(
    userPublicIdentifier: string,
    assetId: string,
  ): Promise<RebalancingTargetsResponse<BigNumber> | undefined> {
    const rebalancingServiceUrl = this.configService.getRebalancingServiceUrl();
    if (!rebalancingServiceUrl) {
      logger.debug(`Rebalancing service URL not configured`);
      return undefined;
    }

    const hashedPublicIdentifier = sha256(toUtf8Bytes(userPublicIdentifier));
    const {
      data: rebalancingTargets,
      status,
    }: AxiosResponse<RebalancingTargetsResponse<string>> = await this.httpService
      .get(`${rebalancingServiceUrl}/api/v1/recommendations/asset/${assetId}/channel/${hashedPublicIdentifier}`)
      .toPromise();

    if (status !== 200) {
      logger.warn(`Rebalancing service returned a non-200 response: ${status}`);
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
    userPublicIdentifier: string,
    assetId: string = AddressZero,
  ): Promise<RebalanceProfile | undefined> {
    // try to get rebalance profile configured
    let profile = await this.channelRepository.getRebalanceProfileForChannelAndAsset(userPublicIdentifier, assetId);
    return profile;
  }

  async getLatestWithdrawal(userPublicIdentifier: string): Promise<OnchainTransaction | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userPublicIdentifier ${userPublicIdentifier}`);
    }

    return await this.onchainTransactionRepository.findLatestWithdrawalByUserPublicIdentifier(userPublicIdentifier);
  }

  async getStateChannel(userPublicIdentifier: string): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userPublicIdentifier ${userPublicIdentifier}`);
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
