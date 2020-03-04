import { OutcomeType } from "@connext/types";

import { AppRegistryInfo, singleAssetTwoPartyCoinTransferEncoding } from "../shared";

export const SimpleLinkedTransferApp = "SimpleLinkedTransferApp";

const stateEncoding = `
  tuple(
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    bytes32 linkedHash,
    uint256 amount,
    address assetId,
    bytes32 paymentId,
    bytes32 preImage
  )
`;

export const SimpleLinkedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: SimpleLinkedTransferApp,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  stateEncoding,
};
