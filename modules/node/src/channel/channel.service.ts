import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  Node,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, Logger, OnModuleInit } from "@nestjs/common";
import { BigNumber } from "ethers/utils";
import { Repository } from "typeorm";
import { v4 as generateUUID } from "uuid";

import { ChannelRepoProviderId, NodeProviderId } from "../constants";

import { Channel } from "./channel.entity";

export class ChannelService implements OnModuleInit {
  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
    @Inject(ChannelRepoProviderId)
    private readonly channelRepository: Repository<Channel>,
  ) {}

  async create(
    counterpartyXpub: string,
  ): Promise<NodeTypes.CreateChannelTransactionResult> {
    const multisigResponse = await this.node.call(
      NodeTypes.MethodName.CREATE_CHANNEL,
      {
        params: {
          owners: [this.node.publicIdentifier, counterpartyXpub],
        } as NodeTypes.CreateChannelParams,
        requestId: generateUUID(),
        type: NodeTypes.MethodName.CREATE_CHANNEL,
      },
    );
    Logger.log(
      `multisigResponse.result: ${JSON.stringify(multisigResponse.result)}`,
    );
    return multisigResponse.result as NodeTypes.CreateChannelTransactionResult;
  }

  async deposit(
    multisigAddress: string,
    amount: BigNumber,
    notifyCounterparty: boolean,
  ): Promise<NodeTypes.DepositResult> {
    const depositResponse = await this.node.call(NodeTypes.MethodName.DEPOSIT, {
      params: {
        amount,
        multisigAddress,
        notifyCounterparty,
      },
      requestId: generateUUID(),
      type: NodeTypes.MethodName.DEPOSIT,
    });
    Logger.log(
      `depositResponse.result: ${JSON.stringify(depositResponse.result)}`,
    );
    return depositResponse.result as NodeTypes.DepositResult;
  }

  async addMultisig(xpub, multisigAddress): Promise<Channel> {
    const channel = await this.channelRepository.findOneOrFail({
      where: [{ xpubPartyA: xpub }, { xpubPartyB: xpub }],
    });
    channel.multisigAddress = multisigAddress;
    return await this.channelRepository.save(channel);
  }

  // initialize CF Node with methods from this service to avoid circular dependency
  onModuleInit() {
    this.node.on(
      NodeTypes.EventName.DEPOSIT_CONFIRMED,
      (res: DepositConfirmationMessage) => {
        if (!res || !res.data) {
          return;
        }
        Logger.log(
          `Deposit detected: ${JSON.stringify(res)}, matching`,
          "NodeProvider",
        );
        this.deposit(
          res.data.multisigAddress,
          res.data.amount as any, // FIXME
          res.data.notifyCounterparty,
        );
      },
    );

    this.node.on(
      NodeTypes.EventName.CREATE_CHANNEL,
      (res: CreateChannelMessage) =>
        this.addMultisig(res.data.counterpartyXpub, res.data.multisigAddress),
    );

    Logger.log("Node methods attached", "ChannelService");
  }
}
