import { OutcomeType } from "@connext/types";

import { AppRegistryInfo } from "../shared";
import { FastSignedTransferApp } from "..";
import { singleAssetTwoPartyCoinTransferEncoding } from "../shared";

const paymentsEncoding = `
  tuple(
    uint256 amount,
    address assetId,
    address signer,
    bytes32 paymentId,
    uint256 timeout,
    string recipientXpub,
    bytes32 data,
    bytes signature
  )[]
`;

const stateEncoding = `
  tuple(
    ${paymentsEncoding} lockedPayments,
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    bool finalized,
    uint256 turnNum
  )
`;

const actionEncoding = `
  tuple(
    ${paymentsEncoding} newLockedPayments,
    uint256 actionType
  )
`;

export const FastSignedTransferAppRegistryInfo: AppRegistryInfo = {
  allowNodeInstall: true,
  name: FastSignedTransferApp,
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  stateEncoding,
  actionEncoding,
};
