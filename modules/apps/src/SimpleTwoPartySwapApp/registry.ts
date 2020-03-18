import {
  OutcomeType,
  SimpleSwapAppStateEncoding,
  SimpleTwoPartySwapAppName,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const SimpleTwoPartySwapAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleTwoPartySwapAppName,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  stateEncoding: SimpleSwapAppStateEncoding,
};
