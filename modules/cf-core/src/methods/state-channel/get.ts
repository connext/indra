import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";

export class GetStateChannelController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getStateChannel)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetStateChannel,
  ): Promise<MethodResults.GetStateChannel> {
    return {
      data: (await requestHandler.store.getStateChannel(params.multisigAddress)).toJson(),
    };
  }
}
