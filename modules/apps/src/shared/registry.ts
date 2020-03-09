import { OutcomeType } from "@connext/types";

import { SupportedApplication } from "..";

export type AppRegistryInfo = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  name: SupportedApplication;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

export type AppRegistry = AppRegistryInfo[];
