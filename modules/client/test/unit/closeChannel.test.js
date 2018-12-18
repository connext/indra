const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))
const nock = require('nock')
const { createStubbedHub } = require('../helpers/stubs')

global.fetch = fetch

const Connext = require('../../src/Connext')

// named variables
// on init
const web3 = new Web3('http://localhost:8545')
let client
let ingridAddress
let ingridUrl = 'http://localhost:8080'
let contractAddress = '0xdec16622bfe1f0cdaf6f7f20437d2a040cccb0a1'
let watcherUrl = ''

// for accounts
let accounts
let partyA
let partyB
let partyC
let partyD

describe('closeThread()', () => {
  before('init client and accounts', async () => {
    accounts = await web3.eth.getAccounts()
    ingridAddress = accounts[0]
    partyA = accounts[1]
    partyB = accounts[2]
    partyC = accounts[3]
    partyD = accounts[4]

    const authJson = { token: 'SwSNTnh3LlEJg1N9iiifFgOIKq998PGA' }

    // init client instance
    client = new Connext({
      web3,
      ingridAddress,
      watcherUrl,
      ingridUrl,
      contractAddress
    })
  })

  describe('mocked hub and contract', () => {
    let stubHub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()
      // stub hub methods
      stubHub = await createStubbedHub(
        `${client.ingridUrl}`,
        'OPEN_LC_OPEN_VC',
        'UPDATED'
      )
    })

    it('should close the channel with the given ETH/TOKEN threadId', async () => {
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const sender = partyA
      const sigItoA = await client.closeThread(threadId, sender)
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const sigParams = {
        channelId,
        sig: sigItoA,
        isClose: false,
        partyA: sender.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        openVcs: 0,
        nonce: 2,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      }
      const signer = Connext.recoverSignerFromChannelStateUpdate(sigParams)
      expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
    })

    it('should close the channel with the given ETH threadId', async () => {
      const threadId =
        '0x0200000000000000000000000000000000000000000000000000000000000000'
      const sender = partyC
      const sigItoA = await client.closeThread(threadId, sender)
      const channelId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const sigParams = {
        channelId,
        sig: sigItoA,
        isClose: false,
        partyA: sender.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenBalanceA: Web3.utils.toBN('0'),
        tokenBalanceI: Web3.utils.toBN('0'),
        openVcs: 0,
        nonce: 2,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      }
      const signer = Connext.recoverSignerFromChannelStateUpdate(sigParams)
      expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
    })

    it('should close the channel with the given TOKEN threadId', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const sender = partyD
      const sigItoA = await client.closeThread(threadId, sender)
      const channelId =
        '0x4000000000000000000000000000000000000000000000000000000000000000'
      const sigParams = {
        channelId,
        sig: sigItoA,
        isClose: false,
        partyA: sender.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        ethBalanceA: Web3.utils.toBN('0'),
        ethBalanceI: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        openVcs: 0,
        nonce: 2,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      }
      const signer = Connext.recoverSignerFromChannelStateUpdate(sigParams)
      expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
    })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if no threadId is provided', async () => {
      try {
        await client.closeThread()
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null threadId is provided', async () => {
      const threadId = null
      const sender = partyD
      try {
        await client.closeThread(threadId, sender)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid threadId is provided', async () => {
      const threadId = 'fail'
      const sender = partyD
      try {
        await client.closeThread(threadId, sender)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid sender is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const sender = 'fail'
      try {
        await client.closeThread(threadId, sender)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
