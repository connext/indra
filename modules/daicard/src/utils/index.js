import { ethers as eth } from "ethers";

export { hasPendingTransaction } from "./hasOnchainTransaction";
export { getOwedBalanceInDAI, getAmountInDAI } from "./currencyFormatting";
export { setWallet } from "./actions";

export const toBN = (n) => eth.utils.bigNumberify(n.toString())
