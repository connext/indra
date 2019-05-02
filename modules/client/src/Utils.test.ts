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

const hub = t.mkAddress("0xaa")
const utils = new Utils(hub)

describe('Utils', () => {
  let web3: Web3
  let accounts: string[]
  let partyA: string // web3.eth.sign
  let wallet: eth.Wallet // signer.signMessage
  let walletAddr: string
  let personal: string // web3.eth.personal
  
  beforeEach('instantiate wallets with pk and with web3', async function () {
    // instantiate web3
    // [docker, local]
    const providers = [
      'http://localhost:8545', 
      'http://ethprovider:8545', 
      'http://localhost:3000/api/eth'
    ]

    let provider
    for (const p of providers) {
      web3 = new Web3(new HttpProvider(p))
      try {
        accounts = await web3.eth.getAccounts()
        provider = p
        break
      } catch (e) {
        console.log(`No web3 HTTP provider found at ${p}. Error: `,'' +e)
      }
    }

    if (!provider) {
      console.log(`skipping tests which require web3`)
      this.skip()
      return
    }

    partyA = accounts[1]
    personal = await web3.eth.personal.newAccount("testing")
    // PK for acct: 0x17b105bcb3f06b3098de6eed0497a3e36aa72471
    // ganache mnemonic: refuse result toy bunker royal small story exhaust know piano base stand
    wallet = new eth.Wallet("0x0aba2a064ba9dedf2eb7623e75b7701a72f21acbdad69f60ebaa728a8e00e5bb", new eth.providers.JsonRpcProvider(provider))
    walletAddr = "0x17b105bcb3f06b3098de6eed0497a3e36aa72471"
  })

  it('should properly recover the signer from the channel state update hash', async () => {
    // using web3.eth.sign
    const state = t.getChannelState('full', {
      user: partyA,
      balanceWei: [100, 200],
    })
    // generate hash
    const hash = utils.createChannelStateHash(state)
    // sign using all known methods
    const sigs = [
      { 
        sig: await web3.eth.sign(hash, partyA), 
        signer: partyA,
        method: "web3.eth.sign"
      },
      // TODO: personal sign on ganache?
      // { 
      //   sig: await web3.eth.personal.sign(hash, personal, "testing"), 
      //   signer: personal,
      //   method: "web3.eth.personal.sign"
      // },
      { 
        sig: await wallet.signMessage(hash),
        signer: walletAddr,
        method: "signer.signMessage"
      }
    ]

    // recover signers
    for (const s of sigs) {
      const recovered = utils.recoverSigner(
        hash,
        s.sig,
        s.signer.toLowerCase()
      )
      expect(recovered, "Testing with signing method: " + s.method).to.equal(s.signer.toLowerCase())
    }
  })

  it('should recover the signer from the thread state update', async () => {
    // create and sign channel state update
    const threadStateFingerprint = t.getThreadState('full', {
      balanceWei: [100, 200],
    })
    // generate hash
    const hash = utils.createThreadStateHash(threadStateFingerprint)
    // sign using all known methods
    const sigs = [
      { 
        sig: await web3.eth.sign(hash, partyA), 
        signer: partyA,
        method: "web3.eth.sign"
      },
      // TODO: personal sign on ganache?
      // { 
      //   sig: await web3.eth.personal.sign(hash, personal, "testing"), 
      //   signer: personal,
      //   method: "web3.eth.personal.sign"
      // },
      { 
        sig: await wallet.signMessage(hash),
        signer: walletAddr,
        method: "signer.signMessage"
      }
    ]

    // recover signers
    for (const s of sigs) {
      const recovered = utils.recoverSigner(
        hash,
        s.sig,
        s.signer.toLowerCase()
      )
      expect(recovered, "Testing with signing method: " + s.method).to.equal(s.signer.toLowerCase())
    }
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
