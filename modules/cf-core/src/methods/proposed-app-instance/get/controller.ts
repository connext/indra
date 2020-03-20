import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes, ProtocolTypes } from "../../../types";
import { NodeController } from "../../controller";
import { jsonRpcMethod } from "rpc-server";

export default class GetProposedAppInstanceController extends NodeController {
  @jsonRpcMethod(ProtocolTypes.chan_getProposedAppInstance)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetProposedAppInstanceParams,
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult> {
    return {
      appInstance: await requestHandler.store.getAppInstanceProposal(params.appInstanceId),
    };
  }
}
