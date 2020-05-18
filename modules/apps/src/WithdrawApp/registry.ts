import {
  OutcomeType,
  WithdrawAppStateEncoding,
  WithdrawAppActionEncoding,
  WithdrawAppName,
} from "@connext/types";
import { constants } from "ethers";

import { AppRegistryInfo } from "../shared";

const { Zero } = constants;

export const WithdrawAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: WithdrawAppName,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding: WithdrawAppStateEncoding,
  actionEncoding: WithdrawAppActionEncoding,
};

// timeout default values
export const WITHDRAW_STATE_TIMEOUT = Zero;
