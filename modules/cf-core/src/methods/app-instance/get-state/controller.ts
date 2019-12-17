import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";
import { NO_APP_INSTANCE_ID_FOR_GET_STATE } from "../../errors";

/**
 * Handles the retrieval of an AppInstance's state.
 * @param this
 * @param params
 */
export default class GetStateController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_getState)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetStateParams,
  ): Promise<CFCoreTypes.GetStateResult> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_FOR_GET_STATE);
    }

    const appInstance = await store.getAppInstance(appInstanceId);

    return { state: appInstance.state };
  }
}
