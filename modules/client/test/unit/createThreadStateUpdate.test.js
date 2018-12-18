require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))
const { createStubbedContract, createStubbedHub } = require('../helpers/stubs')
const nock = require('nock')

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
let partyA, partyB, partyC, partyD

describe('createThreadStateUpdate()', function () {
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

  describe('mocked hub', () => {
    let stubHub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()

      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`, 'OPEN_LC_OPEN_VC')
    })

    it('should sign the proposed TOKEN_ETH state update', async () => {
      const update = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        updateType: 'TOKEN_ETH',
        signer: partyA
      }
      const sig = await client.createThreadStateUpdate(update)
      const sigParams = {
        sig,
        channelId: update.channelId,
        nonce: update.nonce,
        partyA,
        partyB,
        ethBalanceA: update.balanceA.ethDeposit,
        ethBalanceB: update.balanceB.ethDeposit,
        tokenBalanceA: update.balanceA.tokenDeposit,
        tokenBalanceB: update.balanceB.tokenDeposit
      }
      const signer = Connext.recoverSignerFromThreadStateUpdate(sigParams)
      expect(signer.toLowerCase()).to.equal(update.signer.toLowerCase())
    })

    it('should sign the proposed ETH state update', async () => {
      const update = {
        channelId: '0x0200000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA: partyC,
        partyB,
        balanceA: {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          tokenDeposit: null
        },
        balanceB: {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          tokenDeposit: null
        },
        updateType: 'ETH',
        signer: partyC
      }
      const sig = await client.createThreadStateUpdate(update)
      const sigParams = {
        sig,
        channelId: update.channelId,
        nonce: update.nonce,
        partyA: partyC,
        partyB,
        ethBalanceA: update.balanceA.ethDeposit,
        ethBalanceB: update.balanceB.ethDeposit,
        tokenBalanceA: Web3.utils.toBN('0'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      const signer = Connext.recoverSignerFromThreadStateUpdate(sigParams)
      expect(signer.toLowerCase()).to.equal(update.signer.toLowerCase())
    })

    it('should sign the proposed TOKEN state update', async () => {
      const update = {
        channelId: '0x0300000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA: partyD,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: null
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: null
        },
        updateType: 'TOKEN',
        signer: partyD
      }
      const sig = await client.createThreadStateUpdate(update)
      const sigParams = {
        sig,
        channelId: update.channelId,
        nonce: update.nonce,
        partyA: partyD,
        partyB,
        ethBalanceA: Web3.utils.toBN('0'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: update.balanceA.tokenDeposit,
        tokenBalanceB: update.balanceB.tokenDeposit
      }
      const signer = Connext.recoverSignerFromThreadStateUpdate(sigParams)
      expect(signer.toLowerCase()).to.equal(update.signer.toLowerCase())
    })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if it is missing channelId', () => {
      let state = {
        nonce: 1,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if channelId is null', () => {
      let state = {
        channelId: null,
        nonce: 1,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if channelId is invalid', () => {
      let state = {
        channelId: 'fail',
        nonce: 1,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if it is missing nonce', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if nonce is null', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: null,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if nonce is invalid', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 'fail',
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no partyA', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyA is null', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA: null,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyA is invalid', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA: 'fail',
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB doesnt exist', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB is null', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB: null,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB is invalid', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB: 'fail',
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if it is missing balanceA', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceA is null', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceA: null,
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceA is invalid', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceA: 'fail',
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceA is malformed', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceA: {},
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceA has 2 null values', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: null,
          ethDeposit: null
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceA has negative tokenDeposit', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('-0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceA has negative ethDeposit', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('-0.9', 'ether'))
        },
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if it is missing balanceB', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceB is null', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceB: null,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceB is invalid', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceB: 'fail',
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceB is malformed', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceB: {},
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceB has 2 null values', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceB: {
          tokenDeposit: null,
          ethDeposit: null
        },
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceB has negative tokenDeposit', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('-0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
        },
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if balanceB has negative ethDeposit', () => {
      let state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 1,
        partyA,
        partyB,
        balanceB: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('-0.9', 'ether'))
        },
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        },
        sender: partyA
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
