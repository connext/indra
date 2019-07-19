import {
  CreateChannelMessage,
  jsonRpcDeserialize,
  JsonRpcResponse,
  Node,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { BigNumber } from "ethers/utils";

import { NodeProviderId } from "../constants";
import { CLogger, freeBalanceAddressFromXpub, registerCfNodeListener } from "../util";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

const logger = new CLogger("ChannelService");

@Injectable()
export class ChannelService {
  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
    private readonly channelRepository: ChannelRepository,
  ) {}

  async create(counterpartyPublicIdentifier: string): Promise<Channel> {
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
    const createChannelResult = createChannelResponse.result as NodeTypes.CreateChannelResult;
    logger.log(`createChannelResult: ${JSON.stringify(createChannelResult, undefined, 2)}`);

    // TODO: remove this when the above line returns multisig
    const multisigResponse = await this.node.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_STATE_DEPOSIT_HOLDER_ADDRESS,
        params: { owners: [this.node.publicIdentifier, counterpartyPublicIdentifier] },
      }),
    );

    const multisigResult: NodeTypes.GetStateDepositHolderAddressResult = multisigResponse!.result
      .result;
    logger.log(`multisigResponse: ${JSON.stringify(multisigResponse, undefined, 2)}`);

    const creationData = await this.createChannelEventFired();
    const channel = new Channel();
    channel.userPublicIdentifier = creationData.data.counterpartyXpub;
    channel.nodePublicIdentifier = this.node.publicIdentifier;
    channel.multisigAddress = creationData.data.multisigAddress;
    channel.available = true;
    return await this.channelRepository.save(channel);
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

  async requestCollateral(userPubId: string): Promise<NodeTypes.DepositResult | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    const profile = await this.channelRepository.getPaymentProfileForChannel(userPubId);

    const freeBalanceResponse = await this.node.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
        params: { multisigAddress: channel.multisigAddress } as NodeTypes.GetFreeBalanceStateParams,
      }),
    );

    const freeBalance = freeBalanceResponse.result as NodeTypes.GetFreeBalanceStateResult;
    const freeBalanceAddress = freeBalanceAddressFromXpub(this.node.publicIdentifier);
    const nodeFreeBalance = freeBalance[freeBalanceAddress];

    if (nodeFreeBalance.lt(profile.minimumMaintainedCollateralWei)) {
      const amountDeposit = profile.amountToCollateralizeWei.sub(nodeFreeBalance);
      logger.log(`Collateralizing ${userPubId} with ${amountDeposit.toString()}`);
      // TODO: takes a long time to resolve and times out on client
      return await this.deposit(channel.multisigAddress, amountDeposit, true);
    }
    logger.log(`User ${userPubId} does not need additional collateral`);
    return undefined;
  }

  // TODO: reject after some time
  private createChannelEventFired(): any {
    return new Promise((res, rej) => {
      registerCfNodeListener(
        this.node,
        NodeTypes.EventName.CREATE_CHANNEL,
        (data: CreateChannelMessage) => {
          res(data);
        },
        logger.cxt,
      );
    });
  }
}
