import Web3 from 'web3'
import Currency from "connext/dist/lib/currency/Currency";
import BN from 'bn.js'

export default async function getWeiBalance (web3: Web3, address: string): Promise<Currency> {
  return new Promise<Currency>((resolve, reject) =>
    web3.eth.getBalance(address, 'latest',
      (e: Error, balance: BN) => e
        ? reject(e)
        : resolve(Currency.WEI(balance.toString())),
    )
  )
}
