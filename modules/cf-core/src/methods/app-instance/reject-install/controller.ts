import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { Node, RejectProposalMessage, NodeEvent } from "../../../types";
import { NodeController } from "../../controller";

export default class RejectInstallController extends NodeController {
  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: Node.RejectInstallParams
  ): Promise<string[]> {
    const { appInstanceId } = params;

    return [appInstanceId];
  }

  @jsonRpcMethod(Node.RpcMethodName.REJECT_INSTALL)
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.RejectInstallParams
  ): Promise<Node.RejectInstallResult> {
    const { store, messagingService, publicIdentifier } = requestHandler;

    const { appInstanceId } = params;

    const appInstanceProposal = await store.getAppInstanceProposal(
      appInstanceId
    );

    const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

    await store.saveStateChannel(stateChannel.removeProposal(appInstanceId));

    const rejectProposalMsg: RejectProposalMessage = {
      from: publicIdentifier,
      type: "REJECT_INSTALL_EVENT" as NodeEvent,
      data: {
        appInstanceId
      }
    };

    const { proposedByIdentifier, proposedToIdentifier } = appInstanceProposal;
    const counterparty =
      publicIdentifier === proposedByIdentifier
        ? proposedToIdentifier
        : proposedByIdentifier;

    await messagingService.send(counterparty, rejectProposalMsg);

    return {};
  }
}
