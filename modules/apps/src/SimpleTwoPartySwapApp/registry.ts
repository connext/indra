import { OutcomeType, SimpleSwapAppStateEncoding, SimpleTwoPartySwapAppName } from "@connext/types";
import { constants } from "ethers";

import { AppRegistryInfo } from "../shared";

const { Zero } = constants;

// timeout default values
export const SWAP_STATE_TIMEOUT = Zero;

export const SimpleTwoPartySwapAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleTwoPartySwapAppName,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleSwapAppStateEncoding,
  stateTimeout: SWAP_STATE_TIMEOUT
};
