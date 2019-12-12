import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { NodeController } from "../../controller";

export default class GetStateChannelController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.GET_STATE_CHANNEL)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.GetStateChannelParams
  ): Promise<Node.GetStateChannelResult> {
    return {
      data: (
        await requestHandler.store.getStateChannel(params.multisigAddress)
      ).toJson()
    };
  }
}
