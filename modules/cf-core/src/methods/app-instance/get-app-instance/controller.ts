import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";
import { NO_APP_INSTANCE_ID_TO_GET_DETAILS } from "../../errors";

/**
 * Handles the retrieval of an AppInstance.
 * @param this
 * @param params
 */
export default class GetAppInstanceDetailsController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_getAppInstance)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetAppInstanceDetailsParams,
  ): Promise<CFCoreTypes.GetAppInstanceDetailsResult> {
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
