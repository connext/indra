import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  jsonRpcDeserialize,
  JsonRpcResponse,
  Node,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { BigNumber } from "ethers/utils";
import { Connection } from "typeorm";

import { NodeProviderId } from "../constants";
import { CLogger } from "../util";
import { freeBalanceAddressFromXpub } from "../util/cfNode";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

const logger = new CLogger("ChannelService");

@Injectable()
export class ChannelService implements OnModuleInit {
  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
    private readonly channelRepository: ChannelRepository,
    private readonly dbConnection: Connection,
  ) {}

  async create(counterpartyPublicIdentifier: string): Promise<Channel> {
    logger.log(`Creating channel for ${counterpartyPublicIdentifier}`);
    const existing = await this.channelRepository.findByUserPublicIdentifier(
      counterpartyPublicIdentifier,
    );
    if (existing) {
      throw new RpcException(`Channel already exists for ${counterpartyPublicIdentifier}`);
    }

    const createChannelResponse = (await this.node.router.dispatch(
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
    const multisigResponse = await this.node.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_STATE_DEPOSIT_HOLDER_ADDRESS,
        params: { owners: [this.node.publicIdentifier, counterpartyPublicIdentifier] },
      }),
    );

    const multisigResult: NodeTypes.GetStateDepositHolderAddressResult = multisigResponse!.result;
    logger.log(`multisigResponse: ${JSON.stringify(multisigResponse, undefined, 2)}`);

    const channel = new Channel();
    channel.userPublicIdentifier = counterpartyPublicIdentifier;
    channel.nodePublicIdentifier = this.node.publicIdentifier;
    channel.multisigAddress = multisigResult.address;
    return await this.channelRepository.save(channel);
  }

  async deposit(
    userPublicIdentifier: string,
    amount: BigNumber,
    notifyCounterparty: boolean,
  ): Promise<NodeTypes.DepositResult> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new RpcException(`No channel exists for user ${userPublicIdentifier}`);
    }

    const depositResponse = await this.node.router.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.DEPOSIT,
        params: {
          amount,
          multisigAddress: channel.multisigAddress,
          notifyCounterparty,
        } as NodeTypes.DepositParams,
      }),
    );
    logger.log(`depositResponse.result: ${JSON.stringify(depositResponse!.result)}`);
    return depositResponse!.result as NodeTypes.DepositResult;
  }

  async makeAvailable(multisigAddress: string): Promise<Channel> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new NotFoundException(`Channel not found for multisigAddress: ${multisigAddress}`);
    }

    channel.available = true;
    return await this.channelRepository.save(channel);
  }

  async requestCollateral(userPubId: string): Promise<NodeTypes.DepositResult | undefined> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    const profile = await this.channelRepository.getPaymentProfileForChannel(userPubId);

    const freeBalanceResponse = await this.node.router.dispatch(
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
      return await this.deposit(userPubId, amountDeposit, true);
    }
    return undefined;
  }

  // initialize CF Node with methods from this service to avoid circular dependency
  onModuleInit(): void {
    // FIXME: is this the right type?
    this.node.on(NodeTypes.EventName.CREATE_CHANNEL, async (res: CreateChannelMessage) => {
      logger.log(`CREATE_CHANNEL event fired: ${JSON.stringify(res)}`);
      await this.makeAvailable((res.data as NodeTypes.CreateChannelResult).multisigAddress);
    });

    // TODO: how many blocks until confirmed?
    this.node.on(NodeTypes.EventName.DEPOSIT_CONFIRMED, (res: DepositConfirmationMessage) => {
      logger.log(`DEPOSIT_CONFIRMED event fired: ${JSON.stringify(res)}`);

      // TODO: add some spam handling
      if (!res || !res.data) {
        return;
      }
      this.deposit(
        res.data.multisigAddress,
        res.data.amount as any, // FIXME
        !!res.data.notifyCounterparty,
      );
    });

    // Print a generic log whenever ANY event is fired
    for (const eventName of [
      "COUNTER_DEPOSIT_CONFIRMED",
      "DEPOSIT_FAILED",
      "DEPOSIT_STARTED",
      "INSTALL",
      "INSTALL_VIRTUAL",
      "PROPOSE_STATE",
      "REJECT_INSTALL",
      "REJECT_STATE",
      "UNINSTALL",
      "UNINSTALL_VIRTUAL",
      "UPDATE_STATE",
      "WITHDRAWAL_CONFIRMED",
      "WITHDRAWAL_FAILED",
      "WITHDRAWAL_STARTED",
      "PROPOSE_INSTALL",
      "PROPOSE_INSTALL_VIRTUAL",
      "PROTOCOL_MESSAGE_EVENT",
      "WITHDRAW_EVENT",
      "REJECT_INSTALL_VIRTUAL",
    ]) {
      this.node.on(NodeTypes.EventName[eventName], (res: any): void =>
        logger.log(`${eventName} event fired`),
      );
    }

    logger.log("Node methods attached");
  }
}
