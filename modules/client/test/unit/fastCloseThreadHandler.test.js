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

describe('fastCloseThreadHandler()', () => {
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

    it('should return sigI on the provided ETH/TOKEN virtual channel closing update', async () => {
      const signer = partyA
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      let sigParams = {
        isClose: false,
        channelId: '0x1000000000000000000000000000000000000000000000000000000000000000',
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
        },
        balanceI: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        signer: partyA,
        hubBond: {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
        }
      }
      const sigA = await client.createChannelStateUpdate(sigParams)
      const sigI = await client.fastCloseThreadHandler({
        sig: sigA,
        signer,
        channelId: threadId
      })
      // generate sigI
      sigParams.signer = ingridAddress
      const trueSigI = await client.createChannelStateUpdate(sigParams)
      expect(sigI).to.equal(trueSigI)
    })

    it('should return sigI on the provided ETH virtual channel closing update', async () => {
      const signer = partyC
      const threadId =
        '0x0200000000000000000000000000000000000000000000000000000000000000'
      let sigParams = {
        isClose: false,
        channelId: '0x3000000000000000000000000000000000000000000000000000000000000000',
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyC,
        balanceA: {
          tokenDeposit: Web3.utils.toBN('0'),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
        },
        balanceI: {
          tokenDeposit: Web3.utils.toBN('0'),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        signer: partyC,
        hubBond: {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
        }
      }
      const sigA = await client.createChannelStateUpdate(sigParams)
      const sigI = await client.fastCloseThreadHandler({
        sig: sigA,
        signer,
        channelId: threadId
      })
      // generate sigI
      sigParams.signer = ingridAddress
      const trueSigI = await client.createChannelStateUpdate(sigParams)
      expect(sigI).to.equal(trueSigI)
    })

    it('should return sigI on the provided TOKEN virtual channel closing update', async () => {
      const signer = partyD
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      let sigParams = {
        isClose: false,
        channelId: '0x4000000000000000000000000000000000000000000000000000000000000000',
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyD,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
          ethDeposit: Web3.utils.toBN('0')
        },
        balanceI: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN('0')
        },
        signer: partyD,
        hubBond: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
        }
      }
      const sigA = await client.createChannelStateUpdate(sigParams)
      const sigI = await client.fastCloseThreadHandler({
        sig: sigA,
        signer,
        channelId: threadId
      })
      // generate sigI
      sigParams.signer = ingridAddress
      const trueSigI = await client.createChannelStateUpdate(sigParams)
      expect(sigI).to.equal(trueSigI)
    })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if no sig is provided', async () => {
      const signer = partyA
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      try {
        await client.fastCloseThreadHandler({
          signer,
          channelId: threadId
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null sig is provided', async () => {
      const sig = null
      const signer = partyA
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      try {
        await client.fastCloseThreadHandler({
          sig,
          signer,
          channelId: threadId
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if sig is not a hex string', async () => {
      const sig = 'fail'
      const signer = partyA
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      try {
        await client.fastCloseThreadHandler({
          sig,
          signer,
          channelId: threadId
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no signer is provided', async () => {
      const sig =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      try {
        await client.fastCloseThreadHandler({
          sig,
          channelId: threadId
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null signer is provided', async () => {
      const sig =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const signer = null
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      try {
        await client.fastCloseThreadHandler({
          sig,
          signer,
          channelId: threadId
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid signer is provided', async () => {
      const sig =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const signer = 'fail'
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      try {
        await client.fastCloseThreadHandler({
          sig,
          signer,
          channelId: threadId
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no channelId is provided', async () => {
      const sig =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const signer = partyA
      try {
        await client.fastCloseThreadHandler({
          sig,
          signer
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null channelId is provided', async () => {
      const sig =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const signer = partyA
      const threadId = null
      try {
        await client.fastCloseThreadHandler({
          sig,
          signer,
          channelId: threadId
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid channelId is provided', async () => {
      const sig =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const signer = partyA
      const threadId = 'fail'
      try {
        await client.fastCloseThreadHandler({
          sig,
          signer,
          channelId: threadId
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
