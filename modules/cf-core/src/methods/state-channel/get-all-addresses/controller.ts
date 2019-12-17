import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";

export default class GetAllChannelAddressesController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_getChannelAddresses)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler
  ): Promise<CFCoreTypes.GetChannelAddressesResult> {
    return {
      multisigAddresses: [
        ...(await requestHandler.store.getStateChannelsMap()).keys()
      ]
    };
  }
}
