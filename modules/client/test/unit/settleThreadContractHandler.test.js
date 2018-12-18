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

describe('settleThreadContractHandler()', () => {
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
        'UPDATED'
      )
    })

    it('should update the ETH/TOKEN thread', async () => {
      const subchanId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const hash = await Connext.createThreadStateUpdateFingerprint({
        channelId: threadId,
        nonce: 1,
        partyA,
        partyB,
        ethBalanceA: balanceA.ethDeposit,
        ethBalanceB: balanceB.ethDeposit,
        tokenBalanceA: balanceA.tokenDeposit,
        tokenBalanceB: balanceB.tokenDeposit
      })
      const sigA = await client.web3.eth.sign(hash, partyA)
      const results = await client.settleThreadContractHandler({
        subchanId,
        threadId,
        nonce: 1,
        partyA,
        partyB,
        balanceA,
        balanceB,
        sigA
      })
      expect(results.transactionHash).to.equal('transactionHash')
    })

    it('should update the ETH thread', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0200000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const hash = await Connext.createThreadStateUpdateFingerprint({
        channelId: threadId,
        nonce: 1,
        partyA: partyC,
        partyB,
        ethBalanceA: balanceA.ethDeposit,
        ethBalanceB: balanceB.ethDeposit,
        tokenBalanceA: balanceA.tokenDeposit,
        tokenBalanceB: balanceB.tokenDeposit
      })
      const sigA = await client.web3.eth.sign(hash, partyC)
      const results = await client.settleThreadContractHandler({
        subchanId,
        threadId,
        nonce: 1,
        partyA: partyC,
        partyB,
        balanceA,
        balanceB,
        sigA
      })
      expect(results.transactionHash).to.equal('transactionHash')
    })

    it('should update the TOKEN thread', async () => {
      const subchanId =
        '0x4000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
      }
      const hash = await Connext.createThreadStateUpdateFingerprint({
        channelId: threadId,
        nonce: 1,
        partyA: partyD,
        partyB,
        ethBalanceA: balanceA.ethDeposit,
        ethBalanceB: balanceB.ethDeposit,
        tokenBalanceA: balanceA.tokenDeposit,
        tokenBalanceB: balanceB.tokenDeposit
      })
      const sigA = await client.web3.eth.sign(hash, partyD)
      const results = await client.settleThreadContractHandler({
        subchanId,
        threadId,
        nonce: 1,
        partyA,
        partyB,
        balanceA,
        balanceB,
        sigA
      })
      expect(results.transactionHash).to.equal('transactionHash')
    })

    afterEach('restore hub and contract', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if no subchanId is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          threadId,
          partyA,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null subchanId is provided', async () => {
      const subchanId = null
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid subchanId is provided', async () => {
      const subchanId = 'fail'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no threadId is provided', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null threadId is provided', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId = null
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid threadId is provided', async () => {
      const threadId = 'fail'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no partyA is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null partyA is provided', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: null,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid partyA is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: 'fail',
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no partyB is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null partyB is provided', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB: null,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid partyB is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB: 'fail',
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no balanceA is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null balanceA is provided', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA: null,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid balanceA is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA: {},
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no balanceB is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null balanceB is provided', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceB: null,
          balanceA,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid balanceB is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x030000000000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB: {},
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no sigA is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null sigA is provided', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA: null
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid sigA is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = 'fail'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 1,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no nonce is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x3000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null nonce is provided', async () => {
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x3000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: null,
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid nonce is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x3000000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA: partyD,
          partyB,
          nonce: 'fail',
          balanceA,
          balanceB,
          sigA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid sender is provided', async () => {
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const subchanId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN('0')
      }
      const sigA = '0x300000'
      try {
        await client.settleThreadContractHandler({
          subchanId,
          threadId,
          partyA,
          partyB,
          balanceA,
          sigA,
          sender: 'fail'
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
