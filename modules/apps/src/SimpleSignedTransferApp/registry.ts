import {
  OutcomeType,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppStateEncoding,
  SimpleSignedTransferAppActionEncoding,
  toBN,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const SimpleSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleSignedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleSignedTransferAppStateEncoding,
  actionEncoding: SimpleSignedTransferAppActionEncoding,
};

// timeout default values
export const SIGNED_TRANSFER_STATE_TIMEOUT = toBN(10);
