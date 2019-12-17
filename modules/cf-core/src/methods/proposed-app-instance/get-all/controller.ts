import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";

export default class GetProposedAppInstancesController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_getProposedAppInstances)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetProposedAppInstancesParams
  ): Promise<CFCoreTypes.GetProposedAppInstancesResult> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    return {
      appInstances: await store.getProposedAppInstances(multisigAddress)
    };
  }
}
