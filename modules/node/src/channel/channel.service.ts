import {
  CreateChannelMessage,
  jsonRpcDeserialize,
  JsonRpcResponse,
  Node,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { AddressZero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { NodeProviderId } from "../constants";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { CLogger, freeBalanceAddressFromXpub, registerCfNodeListener, toBig } from "../util";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

const logger = new CLogger("ChannelService");

@Injectable()
export class ChannelService implements OnModuleInit {
  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
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

    const createChannelResponse = (await this.node.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.CREATE_CHANNEL,
        params: { owners: [this.node.publicIdentifier, counterpartyPublicIdentifier] },
      }),
    )) as JsonRpcResponse;
    const createChannelResult = createChannelResponse.result
      .result as NodeTypes.CreateChannelResult;
    logger.log(`createChannelResult: ${JSON.stringify(createChannelResult, undefined, 2)}`);

    return createChannelResult;
  }

  async deposit(
    multisigAddress: string,
    amount: BigNumber,
    notifyCounterparty: boolean = false,
    tokenAddress?: string,
  ): Promise<NodeTypes.DepositResult> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new RpcException(`No channel exists for multisigAddress ${multisigAddress}`);
    }

    const depositResponse = await this.node.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.DEPOSIT,
        params: {
          amount,
          multisigAddress,
          notifyCounterparty,
          tokenAddress,
        } as NodeTypes.DepositParams,
      }),
    );
    logger.log(`depositResponse.result: ${JSON.stringify(depositResponse!.result)}`);
    return depositResponse!.result as NodeTypes.DepositResult;
  }

  async requestCollateral(
    userPubId: string,
    tokenAddress: string = AddressZero,
  ): Promise<NodeTypes.DepositResult | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    const profile = await this.channelRepository.getPaymentProfileForChannelAndToken(
      userPubId,
      tokenAddress,
    );

    const freeBalanceResponse = await this.node.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
        params: {
          multisigAddress: channel.multisigAddress,
          tokenAddress,
        } as NodeTypes.GetFreeBalanceStateParams,
      }),
    );

    const freeBalance = freeBalanceResponse.result.result as NodeTypes.GetFreeBalanceStateResult;
    const freeBalanceAddress = freeBalanceAddressFromXpub(this.node.publicIdentifier);
    const nodeFreeBalance = freeBalance[freeBalanceAddress];

    if (nodeFreeBalance.lt(profile.minimumMaintainedCollateral)) {
      const amountDeposit = profile.amountToCollateralize.sub(nodeFreeBalance);
      logger.log(
        `Collateralizing ${userPubId} with ${amountDeposit.toString()}, token ${tokenAddress}`,
      );
      return this.deposit(channel.multisigAddress, amountDeposit, true);
    }
    logger.log(`User ${userPubId} does not need additional collateral for token ${tokenAddress}`);
    return undefined;
  }

  async addPaymentProfileToChannel(
    userPubId: string,
    tokenAddress: string,
    minimumMaintainedCollateral: string,
    amountToCollateralize: string,
  ): Promise<PaymentProfile> {
    const profile = new PaymentProfile();
    profile.tokenAddress = tokenAddress;
    profile.minimumMaintainedCollateral = toBig(minimumMaintainedCollateral);
    profile.amountToCollateralize = toBig(amountToCollateralize);
    return await this.channelRepository.addPaymentProfileToChannel(userPubId, profile);
  }

  onModuleInit(): void {
    registerCfNodeListener(
      this.node,
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
        logger.log(`Creating new channel from data ${creationData}`);
        const channel = new Channel();
        channel.userPublicIdentifier = creationData.data.counterpartyXpub;
        channel.nodePublicIdentifier = this.node.publicIdentifier;
        channel.multisigAddress = creationData.data.multisigAddress;
        channel.available = true;
        await this.channelRepository.save(channel);
      },
      logger.cxt,
    );
  }
}
