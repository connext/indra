import {
  DepositConfirmationMessage,
  jsonRpcDeserialize,
  JsonRpcResponse,
  Node,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, OnModuleInit } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { Connection, EntityManager } from "typeorm";
import { v4 as generateUUID } from "uuid";

import { NodeProviderId } from "../constants";
import { User } from "../user/user.entity";
import { UserRepository } from "../user/user.repository";
import { CLogger } from "../util";

import { Channel, ChannelUpdate, NodeChannel } from "./channel.entity";
import { NodeChannelRepository } from "./channel.repository";

const logger = new CLogger("ChannelService");

export class ChannelService implements OnModuleInit {
  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
    private readonly userRepository: UserRepository,
    private readonly nodeChannelRepository: NodeChannelRepository,
    private readonly dbConnection: Connection,
  ) {}

  async create(counterpartyPublicIdentifier: string): Promise<NodeChannel> {
    await this.dbConnection.manager.transaction(
      async (transactionalEntityManager: EntityManager) => {
        let user = await this.userRepository.findByPublicIdentifier(counterpartyPublicIdentifier);
        // create user if does not exist
        if (!user) {
          user = new User();
          user.publicIdentifier = counterpartyPublicIdentifier;
          user.channels = [];
        }

        if (user.channels.length > 0) {
          throw new RpcException(`Channel already exists for user ${counterpartyPublicIdentifier}`);
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
        console.log("createChannelResponse: ", createChannelResponse);
        console.log("createChannelResult: ", createChannelResult);

        // TODO: remove this when the above line returns multisig
        const multisigResponse = (await this.node.router.dispatch(
          jsonRpcDeserialize({
            id: Date.now(),
            jsonrpc: "2.0",
            method: NodeTypes.RpcMethodName.GET_STATE_DEPOSIT_HOLDER_ADDRESS,
            params: { owners: [this.node.publicIdentifier, counterpartyPublicIdentifier] },
          }),
        )) as JsonRpcResponse;

        const multisigResult: NodeTypes.GetStateDepositHolderAddressResult =
          multisigResponse.result;

        const channel = new Channel();
        channel.nodePublicIdentifier = this.node.publicIdentifier;
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

    return await this.nodeChannelRepository.findByPublicIdentifier(counterpartyPublicIdentifier);
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

  // initialize CF Node with methods from this service to avoid circular dependency
  onModuleInit(): void {
    this.node.on(NodeTypes.EventName.DEPOSIT_CONFIRMED, (res: DepositConfirmationMessage) => {
      if (!res || !res.data) {
        return;
      }
      logger.log("DEPOSIT_CONFIRMED event fired");
      logger.log(`Deposit detected: ${JSON.stringify(res)}, matching`);
      this.deposit(
        res.data.multisigAddress,
        res.data.amount as any, // FIXME
        !!res.data.notifyCounterparty,
      );
    });

    this.node.on(NodeTypes.EventName.CREATE_CHANNEL, async (
      res: NodeTypes.CreateMultisigEventData, // FIXME: is this the right type?
    ) => {
      logger.log(`CREATE_CHANNEL event fired: ${JSON.stringify(res)}`);
      // get the free balance
      const fb = await this.node.router.dispatch(
        jsonRpcDeserialize({
          id: Date.now(),
          jsonrpc: "2.0",
          method: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
          params: { multisigAddress: "0x1ab3CD07aC29472571A9eE1B9C09C37e3f07705d" },
        }),
      );
      logger.log(`getFreeBalance res: ${JSON.stringify(fb, null, 2)}`);
    });

    logger.log("Node methods attached");
  }
}
