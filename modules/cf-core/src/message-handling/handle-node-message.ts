import { RejectProposalMessage } from "@connext/types";

import { RequestHandler } from "../request-handler";
import { NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH } from "../errors";
import { StateChannel } from "../models";

export const handleRejectProposalMessage = async (
  requestHandler: RequestHandler,
  receivedRejectProposalMessage: RejectProposalMessage,
) => {
  const { store } = requestHandler;
  const {
    data: { appInstance },
  } = receivedRejectProposalMessage;

  const json = await store.getStateChannelByAppIdentityHash(appInstance.identityHash);
  if (!json) {
    throw new Error(NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH(appInstance.identityHash));
  }
  const stateChannel = StateChannel.fromJson(json).removeProposal(appInstance.identityHash);
  await store.removeAppProposal(stateChannel.multisigAddress, appInstance.identityHash);
};
