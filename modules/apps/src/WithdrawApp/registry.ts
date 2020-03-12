import { OutcomeType, WithdrawAppStateEncoding, WithdrawAppActionEncoding, WithdrawApp } from "@connext/types";

import { AppRegistryInfo } from "../shared";

export const WithdrawAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: WithdrawApp,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: WithdrawAppStateEncoding,
  actionEncoding: WithdrawAppActionEncoding,
};
