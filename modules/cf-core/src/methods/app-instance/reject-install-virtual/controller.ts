import { RequestHandler } from "../../../request-handler";
import { Node, NODE_EVENTS, RejectInstallVirtualMessage, NodeEvent } from "../../../types";

export default async function rejectInstallVirtualController(
  requestHandler: RequestHandler,
  params: Node.RejectInstallParams,
): Promise<Node.RejectInstallResult> {
  const { store, messagingService, publicIdentifier } = requestHandler;

  const { appInstanceId } = params;

  const proposal = await store.getAppInstanceProposal(appInstanceId);

  const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

  await store.saveStateChannel(stateChannel.removeProposal(appInstanceId));

  const rejectInstallVirtualMsg: RejectInstallVirtualMessage = {
    from: publicIdentifier,
    type: NODE_EVENTS.REJECT_INSTALL_VIRTUAL_EVENT as NodeEvent,
    data: {
      appInstanceId
    }
  };

  await messagingService.send(
    proposal.proposedByIdentifier,
    rejectInstallVirtualMsg
  );

  return {};
}
