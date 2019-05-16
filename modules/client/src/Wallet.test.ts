import * as eth from 'ethers'
import { TransactionRequest, Web3Provider } from 'ethers/providers'
import Web3 from 'web3'

import { BN } from './lib/bn'
import { assert, parameterizedTests } from './testing'
import { Utils } from './Utils'
import { Wallet } from './Wallet'

const address: string = '0x627306090abab3a6e1400e9345bc60c78a8bef57'
const mnemonic: string =
  'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
const privateKey: string = '0x8339a8d4aa2aa5771f0230f50c725a4d6e6b7bc87bbf8b63b0c260285346eff6'
const ethUrl: string = process.env.ETH_RPC_URL || 'http://localhost:8545'
const hubUrl: string = ''
const utils: Utils = new Utils()
const web3Provider: any = new Web3.providers.HttpProvider(ethUrl)

////////////////////////////////////////
// Helper Functions

const testSignMessage: any = async (wallet: Wallet): Promise<void> => {
  const msg: string = eth.utils.hexlify(eth.utils.randomBytes(32))
  const sig: string = await wallet.signMessage(msg)
  const recovered: string = utils.recoverSigner(msg, sig, wallet.address) || ''
  assert.equal(recovered, wallet.address)
}

const testSendTransaction: any = async (wallet: Wallet): Promise<void> => {
  const value = eth.utils.parseEther('0.01')
  const nonceBefore: number = await wallet.provider.getTransactionCount(wallet.address)
  const balanceBefore: BN = await wallet.provider.getBalance(wallet.address)
  const tx: any = await wallet.sendTransaction({
    gasLimit: 21000,
    gasPrice: await wallet.provider.getGasPrice(),
    to: eth.constants.AddressZero,
    value,
  })
  wallet.provider.pollingInterval = 100 // default is 4000 which causes test to time out
  await wallet.provider.waitForTransaction(tx.hash)
  const nonceAfter: number = await wallet.provider.getTransactionCount(wallet.address)
  const balanceAfter: BN = await wallet.provider.getBalance(wallet.address)
  assert(balanceAfter.lt(balanceBefore.sub(value))) // lt bc we also pay some amount of gas
  assert(nonceAfter === nonceBefore + 1)
}

////////////////////////////////////////
// Tests

describe('Wallet', () => {

  it('should sign messages properly with a private key', async () => {
    testSignMessage(new Wallet({ hubUrl, privateKey }))
  })

  it('should sign messages properly with a mnemonic', async () => {
    testSignMessage(new Wallet({ hubUrl, mnemonic }))
  })

  it('should sign messages properly with web3', async () => {
    const web3Address = (await (new Web3(web3Provider)).eth.getAccounts())[0].toLowerCase()
    testSignMessage(new Wallet({ hubUrl, user: web3Address, web3Provider }))
  })

  it('should sign transactions properly with a private key', async () => {
    testSendTransaction(new Wallet({ hubUrl, ethUrl, privateKey }))
  })

  it('should sign transactions properly with a mnemonic', async () => {
    testSendTransaction(new Wallet({ hubUrl, ethUrl, mnemonic }))
  })

  // Ganache does not support the eth_signTransaction method
  it.skip('should sign transactions properly with web3', async () => {
    const web3Address = (await (new Web3(web3Provider)).eth.getAccounts())[0].toLowerCase()
    testSignMessage(new Wallet({ hubUrl, user: web3Address, web3Provider }))
  })

  it('should throw an error if not given a signing method', async () => {
    assert.throws(() => new Wallet({ hubUrl }))
  })

})
