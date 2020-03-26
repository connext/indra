import { BigNumber } from "ethers/utils";

import { Address } from "../../basic";
import { tidy } from "../misc";

////////////////////////////////////////
// keep synced w contracts/funding/default-apps/CoinBalanceRefundApp.sol

export const CoinBalanceRefundAppName = "CoinBalanceRefundApp";

export type CoinBalanceRefundAppState = {
  recipient: Address;
  multisig: Address;
  threshold: BigNumber;
  tokenAddress: Address;
};

export const CoinBalanceRefundAppStateEncoding = tidy(`tuple(
  address recipient,
  address multisig,
  uint256 threshold,
  address tokenAddress
)`);
