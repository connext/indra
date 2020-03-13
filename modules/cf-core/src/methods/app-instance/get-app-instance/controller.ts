import { jsonRpcMethod } from "rpc-server";

import { NO_APP_INSTANCE_ID_TO_GET_DETAILS } from "../../../errors";
import { RequestHandler } from "../../../request-handler";
import {
  GetAppInstanceDetailsParams,
  GetAppInstanceDetailsResult,
  MethodNames,
} from "../../../types";

import { NodeController } from "../../controller";

/**
 * Handles the retrieval of an AppInstance.
 * @param this
 * @param params
 */
export default class GetAppInstanceDetailsController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getAppInstance)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: GetAppInstanceDetailsParams,
  ): Promise<GetAppInstanceDetailsResult> {
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
