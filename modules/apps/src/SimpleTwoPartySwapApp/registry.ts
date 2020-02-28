import { OutcomeType } from "@connext/types";

import { AppRegistryInfo, multiAssetMultiPartyCoinTransferEncoding } from "../shared";
import { SimpleTwoPartySwapApp } from "..";

const stateEncoding = `
  tuple(${multiAssetMultiPartyCoinTransferEncoding} coinTransfers)
`;

export const SimpleTwoPartySwapAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleTwoPartySwapApp,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  stateEncoding,
};
