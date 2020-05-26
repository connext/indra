import { MethodNames, MethodParams, MethodResults } from "@connext/types";

import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";
import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

export class GetStateChannelController extends MethodController {
  public readonly methodName = MethodNames.chan_getStateChannel;

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
