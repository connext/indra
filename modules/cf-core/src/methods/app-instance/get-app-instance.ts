import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { NO_APP_IDENTITY_HASH_TO_GET_DETAILS, NO_APP_INSTANCE_FOR_GIVEN_ID } from "../../errors";
import { RequestHandler } from "../../request-handler";

import { NodeController } from "../controller";

/**
 * Handles the retrieval of an AppInstance.
 * @param this
 * @param params
 */
export class GetAppInstanceController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getAppInstance)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetAppInstanceDetails,
  ): Promise<MethodResults.GetAppInstanceDetails> {
    const { store } = requestHandler;
    const { appIdentityHash } = params;

    if (!appIdentityHash) {
      throw new Error(NO_APP_IDENTITY_HASH_TO_GET_DETAILS);
    }

    const appInstance = await store.getAppInstance(appIdentityHash);
    if (!appInstance) {
      throw new Error(NO_APP_INSTANCE_FOR_GIVEN_ID);
    }
    return { appInstance };
  }
}
