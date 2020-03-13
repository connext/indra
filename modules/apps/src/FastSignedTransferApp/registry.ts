import {
  OutcomeType,
  FastSignedTransferAppStateEncoding,
  FastSignedTransferAppActionEncoding,
  FastSignedTransferApp,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";
import {} from "../shared";

export const FastSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: FastSignedTransferApp,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: FastSignedTransferAppStateEncoding,
  actionEncoding: FastSignedTransferAppActionEncoding,
};
