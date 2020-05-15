import { MethodNames, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";

export class GetAllChannelAddressesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getChannelAddresses)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
  ): Promise<MethodResults.GetChannelAddresses> {
    requestHandler.log.newContext("GetAllChannelsMethod").info(
      `Called w no params`,
    );
    const allChannels = await requestHandler.store.getAllChannels();
    return {
      multisigAddresses: allChannels.map(sc => sc.multisigAddress),
    };
  }
}
