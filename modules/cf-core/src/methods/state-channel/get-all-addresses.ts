import { MethodNames, MethodResults } from "@connext/types";

import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

export class GetAllChannelAddressesController extends MethodController {
  public readonly methodName = MethodNames.chan_getChannelAddresses;

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
