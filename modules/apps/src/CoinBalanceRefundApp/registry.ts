import {
  CoinBalanceRefundAppStateEncoding,
  OutcomeType,
  CoinBalanceRefundApp,
} from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const CoinBalanceRefundAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: CoinBalanceRefundApp,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: CoinBalanceRefundAppStateEncoding,
};
