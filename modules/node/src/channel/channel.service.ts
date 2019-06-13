import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { BigNumber } from "ethers/utils";
import { v4 as generateUUID } from "uuid";

import { NodeProviderId } from "../constants";

export class ChannelService {
  constructor(private readonly node: Node) {}

  async create(
    nodeAddress: string,
  ): Promise<NodeTypes.CreateChannelTransactionResult> {
    const multisigResponse = await this.node.call(
      NodeTypes.MethodName.CREATE_CHANNEL,
      {
        params: {
          owners: [this.node.publicIdentifier, nodeAddress],
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
}
