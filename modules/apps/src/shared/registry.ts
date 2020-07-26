import { OutcomeType, SupportedApplicationNames } from "@connext/types";
import { toBN } from "@connext/utils";
import { BigNumber } from "ethers";

export type AppRegistryInfo = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  name: SupportedApplicationNames;
  outcomeType: OutcomeType;
  stateEncoding: string;
  stateTimeout: BigNumber
};

export type AppRegistryType = AppRegistryInfo[];

// timeout default values
export const DEFAULT_APP_TIMEOUT = toBN(8640); // 6 blocks per min (ethereum) * 60 mins * 24h
export const MINIMUM_APP_TIMEOUT = DEFAULT_APP_TIMEOUT.div(2);
