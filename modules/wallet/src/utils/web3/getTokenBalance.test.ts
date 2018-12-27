import Web3 from 'web3'
import {expect} from 'chai'
import getTokenBalance from './getTokenBalance';
import Currency from 'connext/dist/lib/currency/Currency';
const tokenAbi = require('human-standard-token-abi')

const tokenAddress = process.env.REACT_APP_TOKEN_ADDRESS

describe('getTokenBalance', () => {
  it('should get the token balance from Booty contract', async () => {
    const web3 = new Web3()

    const TOKEN_BALANCE = '69'

    const address = '0x69'

    ;(web3 as any).eth.Contract = class MockContract {
      constructor(_tokenAbi: any, tokenAddress: any) {
        expect(_tokenAbi).to.deep.equal(tokenAbi)
        expect(tokenAddress).equals(tokenAddress)
      }

      methods = {
        balanceOf: (_address: string) => {
          expect(_address).equals(address)
          return {call: async () => TOKEN_BALANCE}
        }
      }
    }

    expect(Currency.equals(
      await getTokenBalance(web3, address),
      Currency.BEI(TOKEN_BALANCE)
    )).equals(true)
  })
})
