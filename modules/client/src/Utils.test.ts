import { assert, expect } from 'chai'
import { ethers as eth } from 'ethers'
import Web3 from 'web3'

import { MerkleTree } from './lib/merkleTree'
import * as testUtils from './testing/index'
import {
  ChannelState,
  Provider,
  ThreadState,
} from './types'
import { Utils } from './Utils'

const mnemonic: string =
  'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
const provider: string = process.env.ETH_RPC_URL || 'http://localhost:8545'
const utils: Utils = new Utils()
const wallet: eth.Wallet = eth.Wallet.fromMnemonic(mnemonic)
let web3: Web3 | undefined
let web3Address: string

describe('Utils', () => {
  beforeEach('instantiate wallets with pk and with web3', async () => {
    // Try to connect to web3 and get an associated address
    try {
      web3 = new Web3(new Web3.providers.HttpProvider(provider))
      web3Address = (await web3.eth.getAccounts())[0]
    } catch (e) {/* noop */}
  })

  it('should properly recover the signer from the channel state update hash', async () => {
    const hash: string = utils.createChannelStateHash(
      testUtils.getChannelState('full', { balanceWei: [1, 2], user: wallet.address }),
    )

    // sign using all available methods
    const sigs = [{
        method: 'wallet.signMessage',
        sig: await wallet.signMessage(eth.utils.arrayify(hash)),
        signer: wallet.address,
    }]

    if (web3 && web3Address) {
      sigs.push({
        method: 'web3.eth.sign',
        sig: await web3.eth.sign(hash, web3Address),
        signer: web3Address,
      })
    } else {
      console.warn(`    Couldn't connect to a web3 provider, skipping web3 signing tests`)
    }

    // recover signers
    for (const s of sigs) {
      const recovered: string|undefined = utils.recoverSigner(hash, s.sig, s.signer.toLowerCase())
      expect(recovered, `Testing with signing method: ${s.method}`).to.equal(s.signer.toLowerCase())
    }
  })

  it('should recover the signer from the thread state update', async () => {
    const hash: string = utils.createThreadStateHash(
      testUtils.getThreadState('full', { balanceWei: [1, 2] }),
    )

    // sign using all available methods
    const sigs = [
      {
        method: 'wallet.signMessage',
        sig: await wallet.signMessage(eth.utils.arrayify(hash)),
        signer: wallet.address,
      },
    ]

    if (web3 && web3Address) {
      sigs.push({
        method: 'web3.eth.sign',
        sig: await web3.eth.sign(hash, web3Address),
        signer: web3Address,
      })
    } else {
      console.warn(`    Couldn't connect to a web3 provider, skipping web3 signing tests`)
    }

    // recover signers
    for (const s of sigs) {
      const recovered: string|undefined = utils.recoverSigner(hash, s.sig, s.signer.toLowerCase())
      expect(recovered, `Testing with signing method: ${s.method}`).to.equal(s.signer.toLowerCase())
    }
  })

  it('should return the correct root hash', async () => {
    const threadState: ThreadState = testUtils.getThreadState('empty', {
      balanceWei: [1, 2],
    })
    const threadHash: string = utils.createThreadStateHash(threadState)
    const expectedRoot: string = (new MerkleTree([threadHash])).root
    const generatedRootHash: string = utils.generateThreadRootHash([ threadState ])
    expect(generatedRootHash).to.equal(expectedRoot)
  })

  it('should correctly verify thread proofs', async () => {
    const threadStates: ThreadState[] = [
      testUtils.getThreadState('empty', { balanceWei: [1, 2] }),
      testUtils.getThreadState('empty', { balanceWei: [3, 4] }),
      testUtils.getThreadState('empty', { balanceWei: [5, 6] }),
    ]
    const proof: string = utils.generateThreadProof(threadStates[0], threadStates)
    assert(utils.verifyThreadProof(proof, threadStates))
  })

  describe('hasPendingOps', () => {
    for (const testCase of [
      { input: { balanceWeiHub: '0', pendingDepositTokenHub: '0' }, expected: false },
      { input: { balanceWeiHub: '1', pendingDepositTokenHub: '0' }, expected: false },
      { input: { balanceWeiHub: '0', pendingDepositTokenHub: '1' }, expected: true },
      { input: { balanceWeiHub: '1', pendingDepositTokenHub: '1' }, expected: true },
    ]) {
      it(`${JSON.stringify(testCase.input)} => ${testCase.expected}`, () => {
        assert.equal(utils.hasPendingOps(testCase.input as ChannelState), testCase.expected)
      })
    }
  })

})
