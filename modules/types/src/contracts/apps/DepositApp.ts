import { BigNumber } from "ethers/utils";

import { CoinTransfer } from "../funding";
import {
  singleAssetTwoPartyCoinTransferEncoding,
  tidy,
} from "../misc";
import { Address } from "../../basic";

export const DepositAppName = "DepositApp";

////////////////////////////////////////
// keep synced w contracts/funding/default-apps/DepositApp.sol

// Contract types
export type DepositAppState = {
  transfers: CoinTransfer[];
  multisigAddress: Address;
  assetId: Address;
  startingTotalAmountWithdrawn: BigNumber;
  startingMultisigBalance: BigNumber;
};

export const DepositAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} transfers,
  address multisigAddress,
  address assetId,
  uint256 startingTotalAmountWithdrawn,
  uint256 startingMultisigBalance,
)`);
