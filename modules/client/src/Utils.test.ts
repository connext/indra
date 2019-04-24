require('dotenv').config()
const HttpProvider = require(`ethjs-provider-http`)
import { ethers as eth } from 'ethers';

import { expect, assert } from 'chai'
import { Utils } from './Utils'
import { MerkleUtils } from './helpers/merkleUtils'
// import { MerkleTree } from './helpers/merkleTree'
import MerkleTree from './helpers/merkleTree'
import * as t from './testing/index'
import Web3 from 'web3';
import Wallet from './Wallet';

const hub = t.mkAddress("0xaa")
const utils = new Utils(hub)

describe('Utils', () => {
  let web3: Web3
  let accounts: string[]
  let partyA: string
  let wallet: Wallet // OUR signing wallet
  
  beforeEach('instantiate wallets with pk and with web3', async function () {
    // instantiate web3
    // [docker, local]
    const providers = [
      'http://localhost:8545', 
      'http://ethprovider:8545', 
      'http://localhost:3000/api/eth'
    ]

    let errored = true
    for (const provider of providers) {
      web3 = new Web3(new HttpProvider(provider))
      try {
        accounts = await web3.eth.getAccounts()
        errored = false
        break
      } catch (e) {
        console.log(`No web3 HTTP provider found at ${provider}. Error: `,'' +e)
        errored = true
      }
    }

    if (errored) {
      console.log(`skipping tests which require web3`)
      this.skip()
      return
    }

    partyA = accounts[1]
  })

  it('should properly recover the signer from the channel state update hash with a web3-enabled wallet, using web3.eth.sign', async () => {
    const state = t.getChannelState('full', {
      user: partyA,
      balanceWei: [100, 200],
    })
    // generate hash
    const hash = utils.createChannelStateHash(state)
    // sign
    const sig = await web3.eth.sign(hash, partyA)
    // recover signer
    const signer = utils.recoverSignerFromChannelState(
      state,
      sig,
      "user"
    )
    expect(signer).to.equal(partyA.toLowerCase())
  })

  it.skip('should recover the signer from the channel update when there are no threads', async () => {
    // create and sign channel state update
    const channelStateFingerprint = t.getChannelState('full', {
      balanceWei: [100, 200],
    })
    // generate hash
    const hash = utils.createChannelStateHash(channelStateFingerprint)
    // sign
    const sig = await web3.eth.personal.sign(hash, partyA, '')
    // recover signer
    const signer = utils.recoverSignerFromChannelState(
      channelStateFingerprint,
      sig,
      "user"
    )
    expect(signer).to.equal(partyA.toLowerCase())
  })

  it.skip('should recover the signer from the thread state update', async () => {
    // create and sign channel state update
    const threadStateFingerprint = t.getThreadState('full', {
      balanceWei: [100, 200],
    })
    // generate hash
    const hash = utils.createThreadStateHash(threadStateFingerprint)
    // sign
    const sig = await web3.eth.sign(hash, partyA)
    console.log(hash) // log harcode hash for other hash test
    // recover signer
    const signer = utils.recoverSignerFromThreadState(
      threadStateFingerprint,
      sig,
    )
    expect(signer).to.equal(partyA.toLowerCase())
  })

  it('should return the correct root hash', async () => {
    const threadStateFingerprint = t.getThreadState('empty', {
      balanceWei: [100, 0],
    })
    // TO DO: merkle tree class imports not working...?
    // generate hash
    const hash = utils.createThreadStateHash(threadStateFingerprint)
    // construct elements
    const elements = [
      MerkleUtils.hexToBuffer(hash),
      MerkleUtils.hexToBuffer(utils.emptyRootHash),
    ]
    const merkle = new MerkleTree(elements)
    const expectedRoot = MerkleUtils.bufferToHex(merkle.getRoot())
    const generatedRootHash = utils.generateThreadRootHash([
      threadStateFingerprint,
    ])
    expect(generatedRootHash).to.equal(expectedRoot)
  })

  const hasPendingOpsTests = [
    [{ balanceWeiHub: '0', pendingDepositTokenHub: '0' }, false],
    [{ balanceWeiHub: '1', pendingDepositTokenHub: '0' }, false],
    [{ balanceWeiHub: '0', pendingDepositTokenHub: '1' }, true],
    [{ balanceWeiHub: '1', pendingDepositTokenHub: '1' }, true],
  ]

  hasPendingOpsTests.forEach((t: any) => {
    const input = t[0]
    const expected = t[1]
    it(`hasPendingOps(${JSON.stringify(input)}) => ${expected}`, () => {
      assert.equal(utils.hasPendingOps(input), expected)
    })
  })

})
