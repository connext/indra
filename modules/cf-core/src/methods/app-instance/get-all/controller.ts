import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { Node, AppInstanceJson } from "../../../types";
import { NodeController } from "../../controller";
import { StateChannel } from "../../../models";

/**
 * Gets all installed appInstances across all of the channels open on
 * this Node.
 */
export default class GetAppInstancesController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodNames.chan_getAppInstances)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.GetAppInstancesParams
  ): Promise<Node.GetAppInstancesResult> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    const channels = await store.getStateChannelsMap();

    const appInstances = Array.from(channels.values()).reduce(
      (acc: AppInstanceJson[], channel: StateChannel) => {
        acc.push(
          ...Array.from(channel.appInstances.values()).map(appInstance =>
            appInstance.toJson()
          )
        );
        return acc;
      },
      []
    );

    return {
      appInstances: await store.getAppInstances(multisigAddress)
    };
  }
}
