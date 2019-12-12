import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { NodeController } from "../../controller";

/**
 * Gets all installed appInstances across all of the channels open on
 * this Node.
 */
export default class GetAppInstancesController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.GET_APP_INSTANCES)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.GetAppInstancesParams
  ): Promise<Node.GetAppInstancesResult> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    return {
      appInstances: await store.getAppInstances(multisigAddress)
    };
  }
}
