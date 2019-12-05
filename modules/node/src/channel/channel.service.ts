import { ChannelAppSequences, StateChannelJSON } from "@connext/types";
import { Injectable } from "@nestjs/common";
import { AddressZero, HashZero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { BigNumber, getAddress } from "ethers/utils";

import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ConfigService } from "../config/config.service";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { CLogger, freeBalanceAddressFromXpub } from "../util";
import { CFCoreTypes, CreateChannelMessage } from "../util/cfCore";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

const logger = new CLogger("ChannelService");

@Injectable()
export class ChannelService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly configService: ConfigService,
    private readonly channelRepository: ChannelRepository,
    private readonly cfCoreRepository: CFCoreRecordRepository,
    private readonly onchainRepository: OnchainTransactionRepository,
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
    const existing = await this.channelRepository.findByUserPublicIdentifier(
      counterpartyPublicIdentifier,
    );
    if (existing) {
      throw new Error(`Channel already exists for ${counterpartyPublicIdentifier}`);
    }

    return await this.cfCoreService.createChannel(counterpartyPublicIdentifier);
  }

  async deposit(
    multisigAddress: string,
    amount: BigNumber,
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.DepositResult> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisigAddress ${multisigAddress}`);
    }

    return await this.cfCoreService.deposit(multisigAddress, amount, getAddress(assetId));
  }

  async requestCollateral(
    userPubId: string,
    assetId: string = AddressZero,
    amountToCollateralize?: BigNumber,
  ): Promise<CFCoreTypes.DepositResult | undefined> {
    const normalizedAssetId = getAddress(assetId);
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);

    if (!channel) {
      throw new Error(`Channel does not exist for user ${userPubId}`);
    }

    // TODO: this wont work until we can set this to false when deposit confirms :(
    if (channel.collateralizationInFlight) {
      logger.log(`Collateral request is in flight, try request again for user ${userPubId} later`);
      return undefined;
    }

    const profile = await this.channelRepository.getPaymentProfileForChannelAndToken(
      userPubId,
      normalizedAssetId,
    );

    if (!profile) {
      throw new Error(`Profile does not exist for user ${userPubId} and assetId ${assetId}`);
    }

    let collateralNeeded = profile.minimumMaintainedCollateral;
    if (amountToCollateralize && profile.minimumMaintainedCollateral.lt(amountToCollateralize)) {
      collateralNeeded = amountToCollateralize;
    }

    const freeBalance = await this.cfCoreService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      normalizedAssetId,
    );
    const freeBalanceAddress = freeBalanceAddressFromXpub(
      this.cfCoreService.cfCore.publicIdentifier,
    );
    const nodeFreeBalance = freeBalance[freeBalanceAddress];

    if (nodeFreeBalance.lt(collateralNeeded)) {
      const amountDeposit = collateralNeeded.gt(profile.amountToCollateralize)
        ? collateralNeeded.sub(nodeFreeBalance)
        : profile.amountToCollateralize.sub(nodeFreeBalance);
      logger.log(
        `Collateralizing ${channel.multisigAddress} with ${amountDeposit.toString()}, ` +
          `token: ${normalizedAssetId}`,
      );

      // set in flight so that it cant be double sent
      await this.channelRepository.setInflightCollateralization(channel, true);
      const result = this.deposit(channel.multisigAddress, amountDeposit, normalizedAssetId)
        .then((res: CFCoreTypes.DepositResult) => {
          return res;
        })
        .catch(async (e: any) => {
          await this.clearCollateralizationInFlight(channel.multisigAddress);
          throw e;
        });
      return result;
    }
    logger.log(
      `${userPubId} already has collateral of ${nodeFreeBalance} for asset ${normalizedAssetId}`,
    );
    return undefined;
  }

  async clearCollateralizationInFlight(multisigAddress: string): Promise<Channel> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisig ${multisigAddress}`);
    }

    return await this.channelRepository.setInflightCollateralization(channel, false);
  }

  async addPaymentProfileToChannel(
    userPubId: string,
    assetId: string,
    minimumMaintainedCollateral: BigNumber,
    amountToCollateralize: BigNumber,
  ): Promise<PaymentProfile> {
    const profile = new PaymentProfile();
    profile.assetId = getAddress(assetId);
    profile.minimumMaintainedCollateral = minimumMaintainedCollateral;
    profile.amountToCollateralize = amountToCollateralize;
    return await this.channelRepository.addPaymentProfileToChannel(userPubId, profile);
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
    if (existing) {
      if (
        !creationData.data.owners.includes(existing.nodePublicIdentifier) ||
        !creationData.data.owners.includes(existing.userPublicIdentifier)
      ) {
        throw new Error(
          `Channel has already been created with different owners! ${JSON.stringify(
            existing,
          )}. Event data: ${creationData}`,
        );
      }
      logger.log(`Channel already exists in database`);
    }
    logger.log(`Creating new channel from data ${JSON.stringify(creationData)}`);
    const channel = new Channel();
    channel.userPublicIdentifier = creationData.data.counterpartyXpub;
    channel.nodePublicIdentifier = this.cfCoreService.cfCore.publicIdentifier;
    channel.multisigAddress = creationData.data.multisigAddress;
    channel.available = true;
    await this.channelRepository.save(channel);
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
    const sc = (await this.cfCoreService.getStateChannel(channel.multisigAddress)).data;
    let nodeSequenceNumber;
    try {
      nodeSequenceNumber = (await sc.mostRecentlyInstalledAppInstance()).appSeqNo;
    } catch (e) {
      if (e.message.indexOf("There are no installed AppInstances in this StateChannel") !== -1) {
        nodeSequenceNumber = 0;
      } else {
        throw e;
      }
    }
    if (nodeSequenceNumber !== userSequenceNumber) {
      logger.warn(
        `Node app sequence number (${nodeSequenceNumber}) ` +
          `!== user app sequence number (${userSequenceNumber})`,
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

    const { transactionHash: deployTx } = await this.cfCoreService.deployMultisig(
      channel.multisigAddress,
    );
    logger.debug(`Deploy multisig tx: ${deployTx}`);

    const wallet = this.configService.getEthWallet();
    if (deployTx !== HashZero) {
      logger.debug(`Waiting for deployment transaction...`);
      wallet.provider.waitForTransaction(deployTx);
      logger.debug(`Deployment transaction complete!`);
    } else {
      logger.debug(`Multisig already deployed, proceeding with withdrawal`);
    }

    const txRes = await wallet.sendTransaction(tx);
    await this.onchainRepository.addUserWithdrawal(txRes, channel);
    return txRes;
  }

  async getLatestWithdrawal(userPublicIdentifier: string): Promise<OnchainTransaction | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userPublicIdentifier ${userPublicIdentifier}`);
    }

    return await this.onchainRepository.findLatestWithdrawalByUserPublicIdentifier(
      userPublicIdentifier,
    );
  }

  async getStateChannel(userPublicIdentifier: string): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(
        `No channel exists for userPublicIdentifier ${JSON.stringify(userPublicIdentifier)}`,
      );
    }
    const { data: state } = await this.cfCoreService.getStateChannel(channel.multisigAddress);

    return state.toJson();
  }

  async getStateChannelByMultisig(multisigAddress: string): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new Error(`No channel exists for multisigAddress ${multisigAddress}`);
    }
    const { data: state } = await this.cfCoreService.getStateChannel(multisigAddress);

    return state.toJson();
  }

  async getAllChannels(): Promise<Channel[]> {
    const channels = await this.channelRepository.findAll();
    if (!channels) {
      throw new Error(`No channels found. This should never happen`);
    }
    return channels;
  }
}
