import { ethers as eth } from 'ethers'
import { TransactionRequest, Web3Provider } from 'ethers/providers'
import { BigNumber as BN } from 'ethers/utils'
import Web3 from 'web3'

import { ConnextClientOptions } from './Connext'
import { toWeiBig } from './lib/bn'
import { assert, parameterizedTests } from './testing'
import { Utils } from './Utils'
import Wallet from './Wallet'

const mnemonic: string =
  'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
const providers: string[] = [
  'http://localhost:8545',
  'http://ethprovider:8545',
  'http://localhost:3000/api/eth',
  'http://127.0.0.1:8545',
]
let web3: Web3 | undefined
let web3Address1: string
let web3Address2: string
let web3Provider: Web3Provider
const web3Tests: ITestCase[] = []
let provider: eth.providers.JsonRpcProvider

interface ITestCase {
  name: string,
  opts: ConnextClientOptions
  expected: {
    address: string,
  }
}

describe.only('Wallet', () => {

  before(async () => {
    for (const p of providers) {
      try {
        console.log(`Attempting to connect to provider: ${p}`)
        web3 = new Web3(new Web3.providers.HttpProvider(p))
        provider = new eth.providers.JsonRpcProvider(p)
        web3Address1 = (await web3.eth.getAccounts())[0]
        web3Address2 = (await web3.eth.getAccounts())[1]
        console.log('Success')
        break
      } catch (e) {/* noop */}
    }
  })

  parameterizedTests([
    {
      expected: { address: web3Address1 },
      name: 'should work with a web3 provider and user',
      opts: {
        hubUrl: '',
        user: web3Address1,
        web3Provider,
      },
    },
  ], async (tc: any): Promise<any> => {
    // skip any tests referring to web3 if we could not find it
    // NOTE: this means web3 string has to be in the test name
    if (tc.name.includes('web3') && (!web3 || !web3Address1 || !web3Address2)) {
      return
    } else if (web3 && tc.name.includes('web3')) {
      const accts: string[] = await web3.eth.getAccounts()
      // update the test case values
      web3Address1 = accts[0].toLowerCase()
      web3Address2 = accts[1].toLowerCase()
      web3Provider = web3.currentProvider as any
      tc = {
        ...tc,
        expected: {
          ...tc.expected,
          address: web3Address1,
        },
        opts: {
          ...tc.opts,
          user: web3Address1,
          web3Provider,
        },
      }
    }

    // instantiate the wallet
    const wallet: Wallet = new Wallet(tc.opts)
    console.log('***** instantiated wallet')

    const addr: string = await wallet.getAddress()
    assert.equal(addr, tc.expected.address)
    console.log('***** correct address')

    const msg: string = eth.utils.solidityKeccak256(
      ['bytes32'],
      [eth.utils.randomBytes(32)],
    )

    // test signing a message
    const sig: string = await wallet.signMessage(msg)
    console.log('***** sig', sig)
    const recovered: string | undefined = new Utils().recoverSigner(msg, sig, tc.expected.address)
    console.log('***** recovered', recovered)
    assert.equal(recovered, tc.expected.address)
    console.log('***** recoveredCorrectly')

    // test sending a transaction
    const txReq: TransactionRequest = {
      from: wallet.address,
      gasLimit: 600000,
      gasPrice: 600000,
      to: web3Address2,
      value: toWeiBig(10).toString(),
    }
    // get balance before sending
    // TODO: why does the wallet provider just not work for this call?
    const balanceBefore: BN = await provider.getBalance(wallet.address)
    console.log('***** previous balance', balanceBefore.toString())
    const expectedBal: BN = balanceBefore.sub(toWeiBig(10))

    // TODO
    const tx: any = await wallet.sendTransaction(txReq)
    console.log('***** tx', tx)

    const balanceAfter: BN = await provider.getBalance(wallet.address)

    assert.equal(balanceAfter.toString(), expectedBal.toString())
  })
})
