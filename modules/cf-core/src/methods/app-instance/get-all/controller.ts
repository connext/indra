import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, ProtocolTypes } from "../../../types";
import { NodeController } from "../../controller";

/**
 * Gets all installed appInstances across all of the channels open on
 * this Node.
 */
export default class GetAppInstancesController extends NodeController {
  @jsonRpcMethod(ProtocolTypes.chan_getAppInstances)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetAppInstancesParams,
  ): Promise<CFCoreTypes.GetAppInstancesResult> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    if (!multisigAddress) {
      throw new Error("Multisig address must be provided");
    }

    return {
      appInstances: await store.getAppInstances(multisigAddress),
    };
  }
}
