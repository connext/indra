import {
  coinBalanceRefundAppStateEncoding,
  OutcomeType,
  CoinBalanceRefundAppName,
} from "@connext/types";

import { AppRegistryInfo } from "./shared";

export const CoinBalanceRefundAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: CoinBalanceRefundAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: coinBalanceRefundAppStateEncoding,
};

