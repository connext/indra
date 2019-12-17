import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";

export default class GetProposedAppInstanceController extends NodeController {
  public static readonly methodName = CFCoreTypes.MethodName.GET_PROPOSED_APP_INSTANCE;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetProposedAppInstanceParams
  ): Promise<CFCoreTypes.GetProposedAppInstanceResult> {
    return {
      appInstance: await requestHandler.store.getAppInstanceProposal(
        params.appInstanceId
      )
    };
  }
}
