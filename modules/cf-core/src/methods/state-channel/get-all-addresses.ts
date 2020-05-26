import { MethodNames, MethodResults } from "@connext/types";

import { RequestHandler } from "../../request-handler";
import { jsonRpcMethod } from "../../rpc-router";

import { NodeController } from "../controller";

export class GetAllChannelAddressesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getChannelAddresses)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
  ): Promise<MethodResults.GetChannelAddresses> {
    const allChannels = await requestHandler.store.getAllChannels();
    return {
      multisigAddresses: allChannels.map((sc) => sc.multisigAddress),
    };
  }
}
