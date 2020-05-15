import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";

export class GetProposedAppInstancesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getProposedAppInstances)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetProposedAppInstances,
  ): Promise<MethodResults.GetProposedAppInstances> {
    const { store } = requestHandler;
    const { multisigAddress } = params;
    requestHandler.log.newContext("GetProposedAppsMethod").info(
      `Called w params: ${JSON.stringify(params)}`,
    );

    if (!multisigAddress) {
      throw new Error(`Multisig address is required.`);
    }

    const channel = await store.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }

    return {
      appInstances: channel.proposedAppInstances.map(([id, proposal]) => proposal),
    };
  }
}
