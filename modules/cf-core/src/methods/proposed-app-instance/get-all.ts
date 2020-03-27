import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";

export class GetProposedAppInstancesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getProposedAppInstances)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetProposedAppInstances,
  ): Promise<MethodResults.GetProposedAppInstances> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    if (!multisigAddress) {
      throw new Error(`Multisig address is required.`);
    }

    return {
      appInstances: await store.getProposedAppInstances(multisigAddress),
    };
  }
}
