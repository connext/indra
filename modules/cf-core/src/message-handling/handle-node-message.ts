import { RequestHandler } from "../request-handler";
import { RejectProposalMessage } from "../types";
import { NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID } from "../errors";
import { StateChannel } from "../models";

export async function handleRejectProposalMessage(
  requestHandler: RequestHandler,
  receivedRejectProposalMessage: RejectProposalMessage,
) {
  const { store } = requestHandler;
  const {
    data: { appInstanceId },
  } = receivedRejectProposalMessage;

  const json = await store.getStateChannelByAppInstanceId(appInstanceId);
  if (!json) {
    throw new Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appInstanceId));
  }
  const stateChannel = StateChannel.fromJson(json).removeProposal(appInstanceId);
  await store.removeAppProposal(stateChannel.multisigAddress, appInstanceId);
}
