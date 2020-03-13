import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";
import {
  GetProposedAppInstanceParams,
  GetProposedAppInstanceResult,
  MethodNames,
} from "../../types";
import { NodeController } from "../controller";

export class GetProposedAppInstanceController extends NodeController {
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
