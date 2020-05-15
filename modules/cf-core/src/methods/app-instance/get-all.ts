import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";

/**
 * Gets all installed appInstances across all of the channels open on
 * this Node.
 */
export class GetInstalledAppInstancesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getAppInstances)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetAppInstances,
  ): Promise<MethodResults.GetAppInstances> {
    const { store } = requestHandler;
    const { multisigAddress } = params;
    requestHandler.log.newContext("CF-GetAppInstancesMethod").info(
      `Called w params: ${JSON.stringify(params)}`,
    );

    if (!multisigAddress) {
      throw new Error("Multisig address must be provided");
    }

    const channel = await store.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }

    return {
      appInstances: channel.appInstances.map(([id, json]) => json),
    };
  }
}
