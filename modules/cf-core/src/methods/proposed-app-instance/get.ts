import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";

import { NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH } from "../../errors";
import { RequestHandler } from "../../request-handler";

import { MethodController } from "../controller";

export class GetProposedAppInstanceController extends MethodController {
  public readonly methodName = MethodNames.chan_getProposedAppInstance;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetProposedAppInstance,
  ): Promise<MethodResults.GetProposedAppInstance> {
    const appInstance = await requestHandler.store.getAppProposal(params.appIdentityHash);
    if (!appInstance) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(params.appIdentityHash));
    }
    return { appInstance: bigNumberifyJson(appInstance) };
  }
}
