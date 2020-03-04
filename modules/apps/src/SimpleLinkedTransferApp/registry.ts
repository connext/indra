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
  actionEncoding: `tuple(bytes32 preImage)`,
  allowNodeInstall: true,
  name: SimpleLinkedTransferApp,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding,
};
