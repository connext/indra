import { RequestHandler } from "../../../request-handler";
import {
  GetProposedAppInstanceParams,
  GetProposedAppInstanceResult,
  MethodNames,
} from "../../../types";
import { NodeController } from "../../controller";
import { jsonRpcMethod } from "rpc-server";

export default class GetProposedAppInstanceController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getProposedAppInstance)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: GetProposedAppInstanceParams,
  ): Promise<GetProposedAppInstanceResult> {
    return {
      appInstance: await requestHandler.store.getAppInstanceProposal(params.appInstanceId),
    };
  }
}
