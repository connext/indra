import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, Injectable } from "@nestjs/common";
import { v4 as generateUUID } from "uuid";

import { NodeProviderId } from "../constants";

@Injectable()
export class ChannelService {
  constructor(@Inject(NodeProviderId) private readonly node: Node) {}

  async create(
    nodeAddress: string,
  ): Promise<NodeTypes.CreateChannelTransactionResult> {
    const multisigResponse = await this.node.call(
      NodeTypes.MethodName.CREATE_CHANNEL,
      {
        params: {
          owners: [this.node.publicIdentifier, nodeAddress],
        } as NodeTypes.CreateChannelParams,
        type: NodeTypes.MethodName.CREATE_CHANNEL,
        requestId: generateUUID(),
      },
    );

    return multisigResponse.result as NodeTypes.CreateChannelTransactionResult;
  }
}
