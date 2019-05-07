import { assert, expect } from 'chai'
import { ethers as eth } from 'ethers'
import Web3 from 'web3'

import MerkleTree from './lib/merkleTree'
import { MerkleUtils } from './lib/merkleUtils'
import * as testUtils from './testing/index'
import {
  Provider,
} from './types'
import { Utils } from './Utils'

const mnemonic: string =
  'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
const providers: string[] = [
  'http://localhost:8545',
  'http://ethprovider:8545',
  'http://localhost:3000/api/eth',
  'http://ganache:8545',
]
const utils: Utils = new Utils()
const wallet: eth.Wallet = eth.Wallet.fromMnemonic(mnemonic)
let web3: Web3 | undefined
let web3Address: string

describe('Utils', () => {
  beforeEach('instantiate wallets with pk and with web3', async () => {
    // Try to connect to web3 and get an associated address
    for (const p of providers) {
      try {
        web3 = new Web3(new Web3.providers.HttpProvider(p))
        web3Address = (await web3.eth.getAccounts())[0]
        break
      } catch (e) {/* noop */}
    }
  })

  it('should properly recover the signer from the channel state update hash', async () => {
    const hash: string = utils.createChannelStateHash(
      testUtils.getChannelState('full', {
        balanceWei: [1, 2],
        user: wallet.address,
      }),
    )

    // sign using all available methods
    const sigs: any = [{
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
      const recovered: any = utils.recoverSigner(
        hash,
        s.sig,
        s.signer.toLowerCase(),
      )
      expect(recovered, `Testing with signing method: ${s.method}`).to.equal(s.signer.toLowerCase())
    }
  })

  it('should recover the signer from the thread state update', async () => {
    const hash: string = utils.createThreadStateHash(
      testUtils.getThreadState('full', {
        balanceWei: [1, 2],
      }),
    )

    // sign using all available methods
    const sigs: any = [
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
      const recovered: any = utils.recoverSigner(
        hash,
        s.sig,
        s.signer.toLowerCase(),
      )
      expect(recovered, `Testing with signing method: ${s.method}`).to.equal(s.signer.toLowerCase())
    }
  })

  it('should return the correct root hash', async () => {
    const threadStateFingerprint: any = testUtils.getThreadState('empty', {
      balanceWei: [1, 2],
    })
    // TO DO: merkle tree class imports not working...?
    // generate hash
    const hash: string = utils.createThreadStateHash(threadStateFingerprint)
    // construct elements
    const elements: any = [
      MerkleUtils.hexToBuffer(hash),
      MerkleUtils.hexToBuffer(utils.emptyRootHash),
    ]
    const merkle: any = new MerkleTree(elements)
    const expectedRoot: any = MerkleUtils.bufferToHex(merkle.getRoot())
    const generatedRootHash: any = utils.generateThreadRootHash([
      threadStateFingerprint,
    ])
    expect(generatedRootHash).to.equal(expectedRoot)
  })

  const hasPendingOpsTests: any = [
    [{ balanceWeiHub: '0', pendingDepositTokenHub: '0' }, false],
    [{ balanceWeiHub: '1', pendingDepositTokenHub: '0' }, false],
    [{ balanceWeiHub: '0', pendingDepositTokenHub: '1' }, true],
    [{ balanceWeiHub: '1', pendingDepositTokenHub: '1' }, true],
  ]

  hasPendingOpsTests.forEach((test: any) => {
    const input: any = test[0]
    const expected: any = test[1]
    it(`hasPendingOps(${JSON.stringify(input)}) => ${expected}`, () => {
      assert.equal(utils.hasPendingOps(input), expected)
    })
  })

})
