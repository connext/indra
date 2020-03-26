import {
  FastSignedTransferAppActionEncoding,
  FastSignedTransferAppName,
  FastSignedTransferAppStateEncoding,
  OutcomeType,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const FastSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: FastSignedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: FastSignedTransferAppStateEncoding,
  actionEncoding: FastSignedTransferAppActionEncoding,
};
