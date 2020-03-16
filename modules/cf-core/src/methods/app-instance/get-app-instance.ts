import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { NO_APP_INSTANCE_ID_TO_GET_DETAILS } from "../../errors";
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
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_TO_GET_DETAILS);
    }

    return {
      appInstance: (await store.getAppInstance(appInstanceId)).toJson(),
    };
  }
}
