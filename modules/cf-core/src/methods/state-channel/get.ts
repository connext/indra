import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import {
  GetStateChannelParams,
  GetStateChannelResult,
  MethodNames,
} from "../../types";
import { NodeController } from "../controller";

export class GetStateChannelController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getStateChannel)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: GetStateChannelParams,
  ): Promise<GetStateChannelResult> {
    return {
      data: (await requestHandler.store.getStateChannel(params.multisigAddress)).toJson(),
    };
  }
}
