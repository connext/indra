import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import { NO_APP_INSTANCE_ID_FOR_GET_STATE } from "../../errors";

import { NodeController } from "../controller";

/**
 * Handles the retrieval of an AppInstance's state.
 * @param this
 * @param params
 */
export class GetAppInstanceStateController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getState)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetState,
  ): Promise<MethodResults.GetState> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_FOR_GET_STATE);
    }

    const appInstance = await store.getAppInstance(appInstanceId);

    return { state: appInstance.state };
  }
}
