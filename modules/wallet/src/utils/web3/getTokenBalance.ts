import Web3 from 'web3'
import Currency from "connext/dist/lib/currency/Currency";
import { HumanStandardToken } from "./HumanStandardToken";
const tokenABI = require('human-standard-token-abi')

const tokenAddress = process.env.REACT_APP_TOKEN_ADDRESS

export default async function getTokenBalance(
  web3: Web3,
  address: string,
  token: string = tokenAddress!
): Promise<Currency> {

  const contract = new web3.eth.Contract(tokenABI, token) as HumanStandardToken

  try {
    const amount = await contract
       .methods
       .balanceOf(address)
       .call()

    return  Currency.BEI(amount)
  } catch(e){
    throw new Error(`unable to get ERC20 balance ${address} ${e}`)
  }
}
