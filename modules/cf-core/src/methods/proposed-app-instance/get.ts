import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID } from "../../errors";

export class GetProposedAppInstanceController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getProposedAppInstance)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetProposedAppInstance,
  ): Promise<MethodResults.GetProposedAppInstance> {
    const appInstance = await requestHandler.store.getAppProposal(params.appInstanceId);
    if (!appInstance) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(params.appInstanceId));
    }
    return { appInstance };
  }
}
