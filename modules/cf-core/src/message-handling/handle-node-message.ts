import { RejectProposalMessage } from "@connext/types";

import { RequestHandler } from "../request-handler";
import { NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH } from "../errors";
import { StateChannel } from "../models";

export async function handleRejectProposalMessage(
  requestHandler: RequestHandler,
  receivedRejectProposalMessage: RejectProposalMessage,
) {
  const { store } = requestHandler;
  const {
    data: { appIdentityHash },
  } = receivedRejectProposalMessage;

  const json = await store.getStateChannelByAppIdentityHash(appIdentityHash);
  if (!json) {
    throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appIdentityHash));
  }
  const stateChannel = StateChannel.fromJson(json).removeProposal(appIdentityHash);
  await store.removeAppProposal(stateChannel.multisigAddress, appIdentityHash);
}
