import {
  OutcomeType,
  SimpleSignedTransferApp,
  SignedTransferAppStateEncoding,
  SignedTransferAppActionEncoding,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const SimpleSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleSignedTransferApp,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: SignedTransferAppStateEncoding,
  actionEncoding: SignedTransferAppActionEncoding,
};
