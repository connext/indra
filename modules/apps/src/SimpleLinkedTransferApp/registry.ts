import {
  OutcomeType,
  SimpleLinkedTransferAppStateEncoding,
  SimpleLinkedTransferAppActionEncoding,
  SimpleLinkedTransferApp,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const SimpleLinkedTransferAppRegistryInfo: AppRegistryInfo = {
  actionEncoding: SimpleLinkedTransferAppActionEncoding,
  allowNodeInstall: true,
  name: SimpleLinkedTransferApp,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleLinkedTransferAppStateEncoding,
};
