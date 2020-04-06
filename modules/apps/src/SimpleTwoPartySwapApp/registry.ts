import {
  OutcomeType,
  SimpleSwapAppStateEncoding,
  SimpleTwoPartySwapAppName,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";
import { Zero } from "ethers/constants";

export const SimpleTwoPartySwapAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleTwoPartySwapAppName,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleSwapAppStateEncoding,
};

// timeout default values
export const SWAP_STATE_TIMEOUT = Zero.toHexString();