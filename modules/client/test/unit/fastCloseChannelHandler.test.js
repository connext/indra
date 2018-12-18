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

describe('fastCloseChannelHandler()', () => {
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
        'OPEN_LC_CLOSED_VC',
        'UPDATED'
      )
    })

    it('should return hubs signature on the closing ETH/TOKEN channel update', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const sigParams = {
        isClose: true,
        channelId,
        nonce: 3,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyA,
        partyI: ingridAddress,
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const hash = Connext.createChannelStateUpdateFingerprint(sigParams)
      const sigA = await web3.eth.sign(hash, partyA)
      const sigI = await web3.eth.sign(hash, ingridAddress)
      const response = await client.fastCloseChannelHandler({
        sig: sigA,
        channelId
      })
      const lcFinal = {
        isClose: true,
        nonce: sigParams.nonce,
        openVcs: sigParams.openVcs,
        vcRootHash: sigParams.vcRootHash,
        ethBalanceA: sigParams.ethBalanceA.toString(),
        ethBalanceI: sigParams.ethBalanceI.toString(),
        tokenBalanceA: sigParams.tokenBalanceA.toString(),
        tokenBalanceI: sigParams.tokenBalanceI.toString(),
        sigA,
        sigI
      }
      expect(response).to.deep.equal(lcFinal)
    })

    it('should return hubs signature on the closing ETH channel update', async () => {
      const channelId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const sigParams = {
        isClose: true,
        channelId,
        nonce: 3,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyC,
        partyI: ingridAddress,
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
      }
      const hash = Connext.createChannelStateUpdateFingerprint(sigParams)
      const sigA = await web3.eth.sign(hash, partyC)
      const sigI = await web3.eth.sign(hash, ingridAddress)
      const response = await client.fastCloseChannelHandler({
        sig: sigA,
        channelId
      })
      const lcFinal = {
        isClose: true,
        nonce: sigParams.nonce,
        openVcs: sigParams.openVcs,
        vcRootHash: sigParams.vcRootHash,
        ethBalanceA: sigParams.ethBalanceA.toString(),
        ethBalanceI: sigParams.ethBalanceI.toString(),
        tokenBalanceA: sigParams.tokenBalanceA.toString(),
        tokenBalanceI: sigParams.tokenBalanceI.toString(),
        sigA,
        sigI
      }
      expect(response).to.deep.equal(lcFinal)
    })

    it('should return hubs signature on the closing TOKEN channel update', async () => {
      const channelId =
        '0x4000000000000000000000000000000000000000000000000000000000000000'
      const sigParams = {
        isClose: true,
        channelId,
        nonce: 3,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyD,
        partyI: ingridAddress,
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const hash = Connext.createChannelStateUpdateFingerprint(sigParams)
      const sigA = await web3.eth.sign(hash, partyD)
      const sigI = await web3.eth.sign(hash, ingridAddress)
      const response = await client.fastCloseChannelHandler({
        sig: sigA,
        channelId
      })
      const lcFinal = {
        isClose: true,
        nonce: sigParams.nonce,
        openVcs: sigParams.openVcs,
        vcRootHash: sigParams.vcRootHash,
        ethBalanceA: sigParams.ethBalanceA.toString(),
        ethBalanceI: sigParams.ethBalanceI.toString(),
        tokenBalanceA: sigParams.tokenBalanceA.toString(),
        tokenBalanceI: sigParams.tokenBalanceI.toString(),
        sigA,
        sigI
      }
      expect(response).to.deep.equal(lcFinal)
    })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })

    describe('parameter validation', () => {
      it('should fail if no sig is provided', async () => {
        const channelId =
          '0x4000000000000000000000000000000000000000000000000000000000000000'
        try {
          await client.fastCloseChannelHandler({
            channelId
          })
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if null sig is provided', async () => {
        const sig = null
        const channelId =
          '0x4000000000000000000000000000000000000000000000000000000000000000'
        try {
          await client.fastCloseChannelHandler({
            sig,
            channelId
          })
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if invalid sig is provided', async () => {
        const sig = 'fail'
        const channelId =
          '0x4000000000000000000000000000000000000000000000000000000000000000'
        try {
          await client.fastCloseChannelHandler({
            sig,
            channelId
          })
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if no channelId is provided', async () => {
        const sig = '0x4000000000'
        try {
          await client.fastCloseChannelHandler({
            sig
          })
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if null channelId is provided', async () => {
        const sig = '0x4000000000'
        const channelId = null
        try {
          await client.fastCloseChannelHandler({
            sig,
            channelId
          })
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if invalid channelId is provided', async () => {
        const sig = '0x4000000000'
        const channelId = 'fail'
        try {
          await client.fastCloseChannelHandler({
            sig,
            channelId
          })
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })
    })
  })
})
