import {
  OutcomeType,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppActionEncoding,
  SimpleLinkedTransferAppStateEncoding,
  toBN,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const SimpleLinkedTransferAppRegistryInfo: AppRegistryInfo = {
  actionEncoding: SimpleLinkedTransferAppActionEncoding,
  allowNodeInstall: true,
  name: SimpleLinkedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleLinkedTransferAppStateEncoding,
};

// timeout default values
export const LINKED_TRANSFER_STATE_TIMEOUT = toBN(10);
