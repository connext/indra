import { parameterizedTests, assert } from "./testing";
import Web3 from "web3";
import { ethers as eth, ethers } from 'ethers'
import Wallet from "./Wallet";
import { Web3Provider, TransactionRequest } from "ethers/providers";
import { Utils } from "./Utils";
import { toWeiBig } from "./lib/bn";
import { ConnextClientOptions } from "./Connext";

const mnemonic: string =
  'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
const providers: string[] = [
  'http://localhost:8545',
  'http://ethprovider:8545',
  'http://localhost:3000/api/eth',
  'http://127.0.0.1:8545'
]
let web3: Web3 | undefined
let web3Address1: string
let web3Address2: string
let web3Provider: Web3Provider
let web3Tests: TestCase[] = []
let provider: eth.providers.JsonRpcProvider

interface TestCase {
  name: string,
  opts: ConnextClientOptions
  expected: {
    address: string
  }
}

describe.skip("Wallet", () => {

  before(async () => {
    console.log('providers', providers)
    // Try to connect to web3 and get an associated address
    for (const p of providers) {
      console.log("Using provider at:", p)
      try {
        web3 = new Web3(new Web3.providers.HttpProvider(p))
        provider = new eth.providers.JsonRpcProvider(p)
        const accts = await web3.eth.getAccounts()
        console.log("Success!")
        break
      } catch (e) {/* noop */}
    }
  })

  parameterizedTests([
    {
      name: "should work with a web3 provider and user",
      opts: {
        user: web3Address1,
        web3Provider,
        hubUrl: "",
      },
      expected: {
        address: web3Address1,
      }
    },
  ], async tc => {
    // skip any tests referring to web3 if we could not find it
    // NOTE: this means web3 string has to be in the test name
    if (!provider) {
      return
    }
    if (!web3 && tc.name.includes("web3")) {
      return
    } else if (web3 && tc.name.includes("web3")) {
      const accts = await web3.eth.getAccounts()
      // update the test case values
      web3Address1 = accts[0].toLowerCase()
      web3Address2 = accts[1].toLowerCase()
      web3Provider = web3.currentProvider as any
      tc = {
        ...tc,
        opts: {
          ...tc.opts,
          user: web3Address1,
          web3Provider,
        },
        expected: {
          ...tc.expected,
          address: web3Address1,
        }
      }
    }

    // instantiate the wallet
    const wallet = new Wallet(tc.opts)
    console.log('***** instantiated wallet')

    const addr = await wallet.getAddress()
    assert.equal(addr, tc.expected.address)
    console.log('***** correct address')

    const msg = eth.utils.solidityKeccak256(
      ['bytes32'], 
      [eth.utils.randomBytes(32)]
    )

    // test signing a message
    const sig = await wallet.signMessage(msg)
    console.log('***** sig', sig)
    const recovered = new Utils().recoverSigner(msg, sig, tc.expected.address)
    console.log('***** recovered', recovered)
    assert.equal(recovered, tc.expected.address)
    console.log('***** recoveredCorrectly')

    // test sending a transaction
    const txReq: TransactionRequest = {
      to: web3Address2,
      from: wallet.address,
      value: toWeiBig(10).toString(),
      gasLimit: 600000,
      gasPrice: 600000,
    }
    // get balance before sending
    // TODO: why does the wallet provider just not work for this call?
    const balanceBefore = await provider.getBalance(wallet.address)
    console.log('***** previous balance', balanceBefore.toString())
    const expectedBal = balanceBefore.sub(toWeiBig(10))

    // TODO: 
    const tx = await wallet.sendTransaction(txReq)
    console.log('***** tx', tx)

    const balanceAfter = await provider.getBalance(wallet.address)

    assert.equal(balanceAfter.toString(), expectedBal.toString())
  })
})