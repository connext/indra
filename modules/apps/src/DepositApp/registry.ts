import {
    DepositAppName,
    DepositAppStateEncoding,
    OutcomeType,
  } from "@connext/types";
  
  import { AppRegistryInfo } from "../shared";
import { Zero } from "ethers/constants";
  
  export const DepositAppRegistryInfo: AppRegistryInfo = {
    allowNodeInstall: true,
    name: DepositAppName,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    stateEncoding: DepositAppStateEncoding,
  };
  
// timeout default values
export const DEPOSIT_STATE_TIMEOUT = Zero.toHexString();