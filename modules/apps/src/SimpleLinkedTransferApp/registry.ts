import {
  OutcomeType,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppActionEncoding,
  SimpleLinkedTransferAppStateEncoding,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const SimpleLinkedTransferAppRegistryInfo: AppRegistryInfo = {
  actionEncoding: SimpleLinkedTransferAppActionEncoding,
  allowNodeInstall: true,
  name: SimpleLinkedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleLinkedTransferAppStateEncoding,
};

