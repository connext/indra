import {
  DepositConfirmationMessage,
  jsonRpcDeserialize,
  JsonRpcResponse,
  Node,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, NotFoundException, OnModuleInit } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { Connection, EntityManager } from "typeorm";
import { v4 as generateUUID } from "uuid";

import { NodeProviderId } from "../constants";
import { User } from "../user/user.entity";
import { UserRepository } from "../user/user.repository";
import { CLogger } from "../util";

import { Channel, ChannelUpdate } from "./channel.entity";

const logger = new CLogger("ChannelService");

export class ChannelService implements OnModuleInit {
  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
    private readonly userRepository: UserRepository,
    private readonly dbConnection: Connection,
  ) {}

  async create(counterpartyXpub: string): Promise<User> {
    await this.dbConnection.manager.transaction(
      async (transactionalEntityManager: EntityManager) => {
        let user = await this.userRepository.findByXpub(counterpartyXpub);
        // create user if does not exist
        if (!user) {
          user = new User();
          user.xpub = counterpartyXpub;
          user.channels = [];
        }

        if (user.channels.length > 0) {
          throw new RpcException(`Channel already exists for user ${counterpartyXpub}`);
        }

        const createChannelResponse = (await this.node.router.dispatch(
          jsonRpcDeserialize({
            id: Date.now(),
            jsonrpc: "2.0",
            method: NodeTypes.RpcMethodName.CREATE_CHANNEL,
            params: { owners: [this.node.publicIdentifier, counterpartyXpub] },
          }),
        )) as JsonRpcResponse;
        const createChannelResult = createChannelResponse.result as NodeTypes.CreateChannelResult;
        console.log("createChannelResponse: ", createChannelResponse);

        // TODO: remove this when the above line returns multisig
        const multisigResponse = (await this.node.router.dispatch(
          jsonRpcDeserialize({
            id: Date.now(),
            jsonrpc: "2.0",
            method: NodeTypes.RpcMethodName.GET_STATE_DEPOSIT_HOLDER_ADDRESS,
            params: { owners: [this.node.publicIdentifier, counterpartyXpub] },
          }),
        )) as JsonRpcResponse;

        const multisigResult = multisigResponse.result as NodeTypes.GetStateDepositHolderAddressResult;

        const channel = new Channel();
        channel.counterpartyXpub = counterpartyXpub;
        channel.multisigAddress = multisigResult.address;
        channel.user = user;

        const update = new ChannelUpdate();
        update.channel = channel;
        update.freeBalancePartyA = Zero;
        update.freeBalancePartyB = Zero;
        update.nonce = 0;

        await transactionalEntityManager.save(user);
        await transactionalEntityManager.save(channel);
        await transactionalEntityManager.save(update);
      },
    );

    return await this.userRepository.findByXpub(counterpartyXpub);
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
    logger.log(`depositResponse.result: ${JSON.stringify(depositResponse.result)}`);
    return depositResponse.result as NodeTypes.DepositResult;
  }

  // actually creates the channel in the db right now, will change when multisig issue resolved
  async addMultisig(xpub: string, multisigAddress: string): Promise<Channel> {
    logger.log(`Multisig deployed for ${xpub}, adding to channel`);
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

    // should probably only ever have one channel per user?
    channel.user = user;

    return await this.dbConnection.manager.transaction(
      async (transactionalEntityManager: EntityManager) => {
        await transactionalEntityManager.save(user);
        await transactionalEntityManager.save(channel);
        await transactionalEntityManager.save(update);
        return channel;
      },
    );
  }

  // initialize CF Node with methods from this service to avoid circular dependency
  onModuleInit(): void {
    this.node.on(NodeTypes.EventName.DEPOSIT_CONFIRMED, (res: DepositConfirmationMessage) => {
      if (!res || !res.data) {
        return;
      }
      logger.log(`Deposit detected: ${JSON.stringify(res)}, matching`);
      this.deposit(
        res.data.multisigAddress,
        res.data.amount as any, // FIXME
        !!res.data.notifyCounterparty,
      );
    });

    this.node.on(NodeTypes.EventName.CREATE_CHANNEL, (
      res: any, // FIXME
    ) => this.addMultisig(res.data.counterpartyXpub, res.data.multisigAddress));

    logger.log("Node methods attached");
  }
}
