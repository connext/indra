import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import {
  GetProposedAppInstancesParams,
  GetProposedAppInstancesResult,
  MethodNames,
} from "../../types";
import { NodeController } from "../controller";

export class GetProposedAppInstancesController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getProposedAppInstances)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: GetProposedAppInstancesParams,
  ): Promise<GetProposedAppInstancesResult> {
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
