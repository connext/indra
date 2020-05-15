import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";
import { NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH } from "../../errors";
import { bigNumberifyJson } from "@connext/utils";

export class GetProposedAppInstanceController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getProposedAppInstance)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetProposedAppInstance,
  ): Promise<MethodResults.GetProposedAppInstance> {
    requestHandler.log.newContext("CF-GetProposedAppMethod").info(
      `Called w params: ${JSON.stringify(params)}`,
    );
    const appInstance = await requestHandler.store.getAppProposal(params.appIdentityHash);
    if (!appInstance) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(params.appIdentityHash));
    }
    return { appInstance: bigNumberifyJson(appInstance) };
  }
}
