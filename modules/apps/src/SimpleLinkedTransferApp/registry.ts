import {
  OutcomeType,
  SimpleLinkedTransferAppStateEncoding,
  SimpleLinkedTransferAppActionEncoding,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const SimpleLinkedTransferApp = "SimpleLinkedTransferApp";

export const SimpleLinkedTransferAppRegistryInfo: AppRegistryInfo = {
  actionEncoding: SimpleLinkedTransferAppActionEncoding,
  allowNodeInstall: true,
  name: SimpleLinkedTransferApp,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleLinkedTransferAppStateEncoding,
};
