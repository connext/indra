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
    data: { appIdentityHash },
  } = receivedRejectProposalMessage;

  const json = await store.getStateChannelByAppInstanceId(appIdentityHash);
  if (!json) {
    throw new Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appIdentityHash));
  }
  const stateChannel = StateChannel.fromJson(json).removeProposal(appIdentityHash);
  await store.removeAppProposal(stateChannel.multisigAddress, appIdentityHash);
}
