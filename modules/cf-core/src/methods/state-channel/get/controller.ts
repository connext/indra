import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, MethodNames } from "../../../types";
import { NodeController } from "../../controller";

export default class GetStateChannelController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getStateChannel)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetStateChannelParams,
  ): Promise<CFCoreTypes.GetStateChannelResult> {
    return {
      data: (await requestHandler.store.getStateChannel(params.multisigAddress)).toJson(),
    };
  }
}
