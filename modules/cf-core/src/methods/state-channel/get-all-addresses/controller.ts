import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, MethodNames } from "../../../types";
import { NodeController } from "../../controller";

export default class GetAllChannelAddressesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getChannelAddresses)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
  ): Promise<CFCoreTypes.GetChannelAddressesResult> {
    return {
      multisigAddresses: [
        ...(await requestHandler.store.getAllChannels()).map(sc => sc.multisigAddress),
      ],
    };
  }
}
