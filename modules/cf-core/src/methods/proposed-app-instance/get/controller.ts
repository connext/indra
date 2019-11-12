import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { NodeController } from "../../controller";

export default class GetProposedAppInstanceController extends NodeController {
  public static readonly methodName = Node.MethodName.GET_PROPOSED_APP_INSTANCE;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.GetProposedAppInstanceParams
  ): Promise<Node.GetProposedAppInstanceResult> {
    return {
      appInstance: await requestHandler.store.getAppInstanceProposal(
        params.appInstanceId
      )
    };
  }
}
