import {
    DepositAppName,
    DepositAppStateEncoding,
    OutcomeType,
  } from "@connext/types";
  
  import { AppRegistryInfo } from "../shared";
  
  export const DepositAppRegistryInfo: AppRegistryInfo = {
    allowNodeInstall: true,
    name: DepositAppName,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    stateEncoding: DepositAppStateEncoding,
  };
  