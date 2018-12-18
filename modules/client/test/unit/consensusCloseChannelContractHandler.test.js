const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))
const nock = require('nock')
const { createStubbedContract, createStubbedHub } = require('../helpers/stubs')

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

describe('consensusCloseChannelContractHandler()', () => {
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
      // stub contract methods
      client.channelManagerInstance.methods = createStubbedContract()
      // activate nock
      if (!nock.isActive()) nock.activate()
      // stub hub methods
      stubHub = await createStubbedHub(
        `${client.ingridUrl}`,
        'OPEN_LC_OPEN_VC',
        'OPEN_LC_CLOSED_VC'
      )
    })

    it('should close the given ETH/TOKEN channel', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigParams = {
        isClose: true,
        channelId,
        nonce: 3,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyA,
        partyI: ingridAddress,
        ethBalanceA: balanceA.ethDeposit,
        ethBalanceI: balanceI.ethDeposit,
        tokenBalanceA: balanceA.tokenDeposit,
        tokenBalanceI: balanceI.tokenDeposit
      }
      const hash = Connext.createChannelStateUpdateFingerprint(sigParams)
      const sigA = await web3.eth.sign(hash, partyA)
      const sigI = await web3.eth.sign(hash, ingridAddress)
      const response = await client.consensusCloseChannelContractHandler({
        channelId,
        nonce: sigParams.nonce,
        balanceA,
        balanceI,
        sigA,
        sigI,
        sender: partyA
      })
      expect(response.transactionHash).to.equal('transactionHash')
      expect(
        client.channelManagerInstance.methods.consensusCloseChannel.calledOnce
      ).to.equal(true)
    })

    it('should close the given ETH channel', async () => {
      const channelId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN('0'),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN('0'),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigParams = {
        isClose: true,
        channelId,
        nonce: 3,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyC,
        partyI: ingridAddress,
        ethBalanceA: balanceA.ethDeposit,
        ethBalanceI: balanceI.ethDeposit,
        tokenBalanceA: balanceA.tokenDeposit,
        tokenBalanceI: balanceI.tokenDeposit
      }
      const hash = Connext.createChannelStateUpdateFingerprint(sigParams)
      const sigA = await web3.eth.sign(hash, partyC)
      const sigI = await web3.eth.sign(hash, ingridAddress)
      const response = await client.consensusCloseChannelContractHandler({
        channelId,
        nonce: sigParams.nonce,
        balanceA,
        balanceI,
        sigA,
        sigI,
        sender: partyC
      })
      expect(response.transactionHash).to.equal('transactionHash')
      expect(
        client.channelManagerInstance.methods.consensusCloseChannel.calledOnce
      ).to.equal(true)
    })

    it('should close the given TOKEN channel', async () => {
      const channelId =
        '0x4000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigParams = {
        isClose: true,
        channelId,
        nonce: 3,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyD,
        partyI: ingridAddress,
        ethBalanceA: balanceA.ethDeposit,
        ethBalanceI: balanceI.ethDeposit,
        tokenBalanceA: balanceA.tokenDeposit,
        tokenBalanceI: balanceI.tokenDeposit
      }
      const hash = Connext.createChannelStateUpdateFingerprint(sigParams)
      const sigA = await web3.eth.sign(hash, partyD)
      const sigI = await web3.eth.sign(hash, ingridAddress)
      const response = await client.consensusCloseChannelContractHandler({
        channelId,
        nonce: sigParams.nonce,
        balanceA,
        balanceI,
        sigA,
        sigI,
        sender: partyD
      })
      expect(response.transactionHash).to.equal('transactionHash')
      expect(
        client.channelManagerInstance.methods.consensusCloseChannel.calledOnce
      ).to.equal(true)
    })

    afterEach('restore hub and contract', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if no channelId is provided', async () => {
      const nonce = 3
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null channelId is provided', async () => {
      const channelId = null
      const nonce = 3
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid channelId is provided', async () => {
      const channelId = 'fail'
      const nonce = 3
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no nonce is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null nonce is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = null
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid nonce is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 'fail'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether'))
      }
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no balanceA is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null balanceA is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceA = null
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid object balanceA is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceA = {}
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no balanceI is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null balanceI is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = null
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid object balanceI is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {}
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no sigA is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null sigA is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = null
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid sigA is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = 'fail'
      const sigI = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no sigI is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigA = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null sigI is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigI = null
      const sigA = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid sigI is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigI = 'fail'
      const sigA = '0x10000000'
      const sender = partyA
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid sender is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const nonce = 3
      const balanceI = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigI = '0x10000000'
      const sigA = '0x10000000'
      const sender = 'fail'
      try {
        await client.consensusCloseChannelContractHandler({
          channelId,
          nonce,
          balanceA,
          balanceI,
          sigA,
          sigI,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
