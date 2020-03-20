import { RequestHandler } from "../request-handler";
import { RejectProposalMessage } from "../types";

export async function handleRejectProposalMessage(
  requestHandler: RequestHandler,
  receivedRejectProposalMessage: RejectProposalMessage,
) {
  const { store } = requestHandler;
  const {
    data: { appInstanceId },
  } = receivedRejectProposalMessage;

  const stateChannel = await store.getStateChannelFromAppInstanceID(appInstanceId);
  const proposal = await store.getAppInstanceProposal(appInstanceId);
  await store.removeAppProposal(stateChannel.removeProposal(appInstanceId), proposal);
}
