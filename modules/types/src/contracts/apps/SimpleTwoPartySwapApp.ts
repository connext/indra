import { tidy } from "../../utils";

import { CoinTransfer } from "../funding";
import { multiAssetMultiPartyCoinTransferEncoding } from "../misc";

export const SimpleTwoPartySwapAppName = "SimpleTwoPartySwapApp";

////////////////////////////////////////
// keep synced w contracts/app/SimpleTwoPartySwappApp.sol

export type SimpleSwapAppState = {
  coinTransfers: CoinTransfer[][];
};

export const SimpleSwapAppStateEncoding = tidy(`tuple(
  ${multiAssetMultiPartyCoinTransferEncoding} coinTransfers
)`);
