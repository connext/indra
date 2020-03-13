import {
  OutcomeType,
  SimpleLinkedTransferApp,
  HashLockTransferAppActionEncoding,
  HashLockTransferAppStateEncoding,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const HashLockTransferAppRegistryInfo: AppRegistryInfo = {
  name: SimpleLinkedTransferApp,
  allowNodeInstall: true,
  actionEncoding: HashLockTransferAppActionEncoding,
  stateEncoding: HashLockTransferAppStateEncoding,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
};
