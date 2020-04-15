import {
  OutcomeType,
  WithdrawAppStateEncoding,
  WithdrawAppActionEncoding,
  WithdrawAppName,
} from "@connext/types";
import { Zero } from "ethers/constants";

import { AppRegistryInfo } from "../shared";

export const WithdrawAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: WithdrawAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: WithdrawAppStateEncoding,
  actionEncoding: WithdrawAppActionEncoding,
};

// timeout default values
export const WITHDRAW_STATE_TIMEOUT = Zero;
