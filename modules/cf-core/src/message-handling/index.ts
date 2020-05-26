import { EventNames } from "@connext/types";

import { handleRejectProposalMessage } from "./handle-node-message";
import { handleReceivedProtocolMessage } from "./handle-protocol-message";

export const eventImplementations = {
  [EventNames.PROTOCOL_MESSAGE_EVENT]: handleReceivedProtocolMessage,
  [EventNames.REJECT_INSTALL_EVENT]: handleRejectProposalMessage,
};
