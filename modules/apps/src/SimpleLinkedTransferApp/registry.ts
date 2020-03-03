import { OutcomeType } from "@connext/types";

import { AppRegistryInfo, multiAssetMultiPartyCoinTransferEncoding } from "../shared";

export const SimpleLinkedTransferApp = "SimpleLinkedTransferApp";

const stateEncoding = `
  tuple(${multiAssetMultiPartyCoinTransferEncoding} coinTransfers)
`;

export const SimpleLinkedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleLinkedTransferApp,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  stateEncoding,
};
