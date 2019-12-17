import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { NodeController } from "../../controller";

export default class GetProposedAppInstancesController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodNames.chan_getProposedAppInstances)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.GetProposedAppInstancesParams
  ): Promise<Node.GetProposedAppInstancesResult> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    return {
      appInstances: await store.getProposedAppInstances(multisigAddress)
    };
  }
}
