import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";

export class GetStateChannelController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getStateChannel)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetStateChannel,
  ): Promise<MethodResults.GetStateChannel> {
    const data = await requestHandler.store.getStateChannel(params.multisigAddress);
    if (!data) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(params.multisigAddress));
    }
    return { data };
  }
}
