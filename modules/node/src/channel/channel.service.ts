import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { forwardRef, Inject, Logger } from "@nestjs/common";
import { BigNumber } from "ethers/utils";
import { Repository } from "typeorm";
import { v4 as generateUUID } from "uuid";

import { ChannelRepoProviderId, NodeProviderId } from "../constants";

import { Channel } from "./channel.entity";

export class ChannelService {
  constructor(
    @Inject(forwardRef(() => NodeProviderId)) private readonly node: Node,
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
}
