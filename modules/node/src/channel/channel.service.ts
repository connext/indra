import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  Node,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { Connection } from "typeorm";
import { v4 as generateUUID } from "uuid";

import { NodeProviderId } from "../constants";
import { UserRepository } from "../user/user.repository";
import { CLogger } from "../util/logger";

import { Channel, ChannelUpdate } from "./channel.entity";

export class ChannelService implements OnModuleInit {
  private logger: CLogger;

  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
    private readonly userRepository: UserRepository,
    private readonly dbConnection: Connection,
  ) {
    this.logger = new CLogger("ChannelService");
  }

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
    this.logger.log(
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
    this.logger.log(
      `depositResponse.result: ${JSON.stringify(depositResponse.result)}`,
    );
    return depositResponse.result as NodeTypes.DepositResult;
  }

  // actually creates the channel in the db right now, will change when multisig issue resolved
  async addMultisig(xpub, multisigAddress): Promise<Channel> {
    this.logger.log(`Multisig deployed for ${xpub}, adding to channel`);
    const user = await this.userRepository.findByXpub(xpub);
    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const channel = new Channel();
    channel.counterpartyXpub = xpub;
    channel.multisigAddress = multisigAddress;

    const update = new ChannelUpdate();
    update.channel = channel;
    update.freeBalancePartyA = Zero;
    update.freeBalancePartyB = Zero;

    channel.updates = [update];

    // should probably only ever have one channel per user?
    channel.user = user;

    return await this.dbConnection.manager.transaction(
      async transactionalEntityManager => {
        const u = await transactionalEntityManager.save(update);
        console.log("u: ", u);
        const c = await transactionalEntityManager.save(channel);
        console.log("c: ", c);
        const us = await transactionalEntityManager.save(user);
        console.log("us: ", us);
        return channel;
      },
    );
  }

  // initialize CF Node with methods from this service to avoid circular dependency
  onModuleInit() {
    this.node.on(
      NodeTypes.EventName.DEPOSIT_CONFIRMED,
      (res: DepositConfirmationMessage) => {
        if (!res || !res.data) {
          return;
        }
        this.logger.log(`Deposit detected: ${JSON.stringify(res)}, matching`);
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

    this.logger.log("Node methods attached");
  }
}
