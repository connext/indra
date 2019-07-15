import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  InstallMessage,
  InstallVirtualMessage,
  jsonRpcDeserialize,
  JsonRpcResponse,
  Node,
  ProposeMessage,
  ProposeVirtualMessage,
  RejectInstallVirtualMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { BigNumber } from "ethers/utils";

import { NodeProviderId } from "../constants";
import { CLogger } from "../util";
import { freeBalanceAddressFromXpub } from "../util/cfNode";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";

const logger = new CLogger("ChannelService");

type CallbackStruct = {
  [index in keyof typeof NodeTypes.EventName]: (data: any) => Promise<any> | void;
};

@Injectable()
export class ChannelService implements OnModuleInit {
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
    multisigAddress: string,
    amount: BigNumber,
    notifyCounterparty: boolean = false,
    tokenAddress?: string,
  ): Promise<NodeTypes.DepositResult> {
    const channel = await this.channelRepository.findByMultisigAddress(multisigAddress);
    if (!channel) {
      throw new RpcException(`No channel exists for multisigAddress ${multisigAddress}`);
    }

    const depositResponse = await this.node.router.dispatch(
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
      logger.log(`Collateralizing ${userPubId} with ${amountDeposit.toString()}`);
      // TODO: takes a long time to resolve and times out on client
      return await this.deposit(channel.multisigAddress, amountDeposit, true);
    }
    logger.log(`User ${userPubId} does not need additional collateral`);
    return undefined;
  }

  // initialize CF Node with methods from this service to avoid circular dependency
  onModuleInit(): void {
    this.registerDefaultCfListeners();
  }

  private logEvent(event: NodeTypes.EventName, res: NodeTypes.NodeMessage & { data: any }): void {
    logger.log(
      `${event} event fired from ${res && res.from ? res.from : null}, data: ${JSON.stringify(
        res.data,
      )}`,
    );
  }

  private registerDefaultCfListeners = (): void => {
    Object.entries(this.defaultCallbacks).forEach(
      ([event, callback]: [NodeTypes.EventName, () => any]): void => {
        logger.log(`Registering default listener for event ${event}`);
        this.node.on(NodeTypes.EventName[event], callback);
      },
    );
  };

  private defaultCallbacks: CallbackStruct = {
    COUNTER_DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
      this.logEvent(NodeTypes.EventName.COUNTER_DEPOSIT_CONFIRMED, data);
    },
    CREATE_CHANNEL: async (data: CreateChannelMessage): Promise<void> => {
      await this.makeAvailable((data.data as NodeTypes.CreateChannelResult).multisigAddress);
      this.logEvent(NodeTypes.EventName.CREATE_CHANNEL, data);
    },
    DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
      this.logEvent(NodeTypes.EventName.DEPOSIT_CONFIRMED, data);
    },
    DEPOSIT_FAILED: (data: any): void => {
      this.logEvent(NodeTypes.EventName.DEPOSIT_FAILED, data);
    },
    DEPOSIT_STARTED: (data: any): void => {
      this.logEvent(NodeTypes.EventName.DEPOSIT_STARTED, data);
    },
    INSTALL: (data: InstallMessage): void => {
      this.logEvent(NodeTypes.EventName.INSTALL, data);
    },
    // TODO: make cf return app instance id and app def?
    INSTALL_VIRTUAL: (data: InstallVirtualMessage): void => {
      this.logEvent(NodeTypes.EventName.INSTALL_VIRTUAL, data);
    },
    PROPOSE_INSTALL: (data: ProposeMessage): void => {
      this.logEvent(NodeTypes.EventName.PROPOSE_INSTALL, data);
    },
    PROPOSE_INSTALL_VIRTUAL: (data: ProposeVirtualMessage): void => {
      this.logEvent(NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL, data);
    },
    PROPOSE_STATE: (data: any): void => {
      // TODO: need to validate all apps here as well?
      this.logEvent(NodeTypes.EventName.PROPOSE_STATE, data);
    },
    PROTOCOL_MESSAGE_EVENT: (data: any): void => {
      this.logEvent(NodeTypes.EventName.PROTOCOL_MESSAGE_EVENT, data);
    },
    REJECT_INSTALL: (data: any): void => {
      this.logEvent(NodeTypes.EventName.REJECT_INSTALL, data);
    },
    REJECT_INSTALL_VIRTUAL: (data: RejectInstallVirtualMessage): void => {
      this.logEvent(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, data);
    },
    REJECT_STATE: (data: any): void => {
      this.logEvent(NodeTypes.EventName.REJECT_STATE, data);
    },
    UNINSTALL: (data: UninstallMessage): void => {
      this.logEvent(NodeTypes.EventName.UNINSTALL, data);
    },
    UNINSTALL_VIRTUAL: (data: UninstallVirtualMessage): void => {
      this.logEvent(NodeTypes.EventName.UNINSTALL_VIRTUAL, data);
    },
    UPDATE_STATE: (data: UpdateStateMessage): void => {
      this.logEvent(NodeTypes.EventName.UPDATE_STATE, data);
    },
    WITHDRAW_EVENT: (data: any): void => {
      this.logEvent(NodeTypes.EventName.WITHDRAW_EVENT, data);
    },
    WITHDRAWAL_CONFIRMED: (data: WithdrawMessage): void => {
      this.logEvent(NodeTypes.EventName.WITHDRAWAL_CONFIRMED, data);
    },
    WITHDRAWAL_FAILED: (data: any): void => {
      this.logEvent(NodeTypes.EventName.WITHDRAWAL_FAILED, data);
    },
    WITHDRAWAL_STARTED: (data: any): void => {
      this.logEvent(NodeTypes.EventName.WITHDRAWAL_STARTED, data);
    },
  };
}
