import { CreateChannelMessage } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { AddressZero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { NodeService } from "../node/node.service";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { CLogger, freeBalanceAddressFromXpub } from "../util";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

const logger = new CLogger("ChannelService");

@Injectable()
export class ChannelService implements OnModuleInit {
  constructor(
    private readonly nodeService: NodeService,
    private readonly channelRepository: ChannelRepository,
  ) {}

  async create(counterpartyPublicIdentifier: string): Promise<NodeTypes.CreateChannelResult> {
    logger.log(`Creating channel for ${counterpartyPublicIdentifier}`);
    const existing = await this.channelRepository.findByUserPublicIdentifier(
      counterpartyPublicIdentifier,
    );
    if (existing) {
      throw new RpcException(`Channel already exists for ${counterpartyPublicIdentifier}`);
    }

    return await this.nodeService.createChannel(counterpartyPublicIdentifier);
  }

  async deposit(
    multisigAddress: string,
    amount: BigNumber,
    assetId: string = AddressZero,
  ): Promise<NodeTypes.DepositResult> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new RpcException(`No channel exists for multisigAddress ${multisigAddress}`);
    }

    return await this.nodeService.deposit(multisigAddress, amount, assetId);
  }

  async requestCollateral(
    userPubId: string,
    assetId: string = AddressZero,
  ): Promise<NodeTypes.DepositResult | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    const profile = await this.channelRepository.getPaymentProfileForChannelAndToken(
      userPubId,
      assetId,
    );

    const freeBalance = await this.nodeService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );
    const freeBalanceAddress = freeBalanceAddressFromXpub(this.nodeService.cfNode.publicIdentifier);
    const nodeFreeBalance = freeBalance[freeBalanceAddress];

    if (nodeFreeBalance.lt(profile.minimumMaintainedCollateral)) {
      const amountDeposit = profile.amountToCollateralize.sub(nodeFreeBalance);
      logger.log(
        `Collateralizing ${channel.multisigAddress} with ${amountDeposit.toString()}, ` +
          `token: ${assetId}`,
      );
      return this.deposit(channel.multisigAddress, amountDeposit, assetId);
    }
    logger.log(`${userPubId} already has collateral of ${nodeFreeBalance} for asset ${assetId}`);
    return undefined;
  }

  async addPaymentProfileToChannel(
    userPubId: string,
    assetId: string,
    minimumMaintainedCollateral: BigNumber,
    amountToCollateralize: BigNumber,
  ): Promise<PaymentProfile> {
    const profile = new PaymentProfile();
    profile.assetId = assetId;
    profile.minimumMaintainedCollateral = minimumMaintainedCollateral;
    profile.amountToCollateralize = amountToCollateralize;
    return await this.channelRepository.addPaymentProfileToChannel(userPubId, profile);
  }

  onModuleInit(): void {
    this.nodeService.registerCfNodeListener(
      NodeTypes.EventName.CREATE_CHANNEL,
      async (creationData: CreateChannelMessage) => {
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
        channel.nodePublicIdentifier = this.nodeService.cfNode.publicIdentifier;
        channel.multisigAddress = creationData.data.multisigAddress;
        channel.available = true;
        await this.channelRepository.save(channel);
      },
      logger.cxt,
    );
  }
}
