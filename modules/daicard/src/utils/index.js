import { ethers as eth } from "ethers";

export { hasPendingTransaction } from "./hasOnchainTransaction";
export { getOwedBalanceInDAI, getAmountInDAI } from "./currencyFormatting";
export { setWallet } from "./actions";

export const toBN = (n) => eth.utils.bigNumberify(n.toString())

export const getChannelBalance = () => ({ token: '3.14', ether: '0.618' })

export const getChainBalance = () => ({ token: '2.71', ether: '1.618' })

export const getExchangeRates = () => ({
  DAI: '100',
  DEI: eth.utils.parseEther('100').toString(),
  ETH: 1,
  WEI: eth.constants.WeiPerEther.toString(),
})
