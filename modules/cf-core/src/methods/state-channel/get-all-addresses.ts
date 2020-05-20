import { MethodNames, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";

export class GetAllChannelAddressesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getChannelAddresses)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
  ): Promise<{ result: MethodResults.GetChannelAddresses }> {
    const allChannels = await requestHandler.store.getAllChannels();
    return {
      result: {
        multisigAddresses: allChannels.map((sc) => sc.multisigAddress),
      },
    };
  }
}
