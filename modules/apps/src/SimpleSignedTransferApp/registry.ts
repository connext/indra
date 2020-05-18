import {
  OutcomeType,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppStateEncoding,
  SimpleSignedTransferAppActionEncoding,
} from "@connext/types";
import { constants } from "ethers";

import { AppRegistryInfo } from "../shared";

const { Zero } = constants;

export const SimpleSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleSignedTransferAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleSignedTransferAppStateEncoding,
  actionEncoding: SimpleSignedTransferAppActionEncoding,
};

// timeout default values
export const SIGNED_TRANSFER_STATE_TIMEOUT = Zero;
