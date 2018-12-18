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

describe('channelUpdateHandler()', function () {
  beforeEach('init client and accounts', async () => {
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

  describe('mocked hub', function () {
    let stubHub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()
      // stub contract methods
      client.channelManagerInstance.methods = createStubbedContract()

      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`, 'OPEN_LC_OPEN_VC')
    })

    it('should create an ETH/TOKEN channel update', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      const sender = partyA
      const updatedPayment = await client.channelUpdateHandler(
        { payment, meta },
        sender
      )
      // expect(updatedPayment.payment.tokenBalanceA).to.equal(payment.balanceA.tokenDeposit.toString())
      // expect(updatedPayment.payment.tokenBalanceI).to.equal(payment.balanceB.tokenDeposit.toString())
      // expect(updatedPayment.payment.ethBalanceA).to.equal(payment.balanceA.ethDeposit.toString())
      // expect(updatedPayment.payment.ethBalanceI).to.equal(payment.balanceB.ethDeposit.toString())

      expect(updatedPayment.payment.balanceA).to.equal(payment.balanceA.ethDeposit.toString())
      expect(updatedPayment.payment.balanceB).to.equal(payment.balanceB.ethDeposit.toString())
    })

    it('should create an ETH channel update', async () => {
        const channelId =
          '0x3000000000000000000000000000000000000000000000000000000000000000'
        const balanceA = {
          tokenDeposit: null,
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether'))
        }
        const balanceB = {
          tokenDeposit: null,
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
        }
        const payment = {
          balanceA,
          balanceB,
          channelId
        }
        const meta = {
          receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
          type: 'PURCHASE',
          fields: {
            productSku: 6969,
            productName: 'Agent Smith'
          }
        }
        const sender = partyC
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          sender
        )
        // expect(updatedPayment.payment.ethBalanceA).to.equal(payment.balanceA.ethDeposit.toString())
        // expect(updatedPayment.payment.ethBalanceI).to.equal(payment.balanceB.ethDeposit.toString())
        // expect(updatedPayment.payment.tokenBalanceA).to.equal('0')
        // expect(updatedPayment.payment.tokenBalanceI).to.equal('0')

        expect(updatedPayment.payment.balanceA).to.equal(payment.balanceA.ethDeposit.toString())
        expect(updatedPayment.payment.balanceB).to.equal(payment.balanceB.ethDeposit.toString())
      })

    it('should create an TOKEN channel update', async () => {
        const channelId =
          '0x4000000000000000000000000000000000000000000000000000000000000000'
        const balanceA = {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether')),
          ethDeposit: null
        }
        const balanceB = {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
          ethDeposit: null
        }
        const payment = {
          balanceA,
          balanceB,
          channelId
        }
        const meta = {
          receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
          type: 'PURCHASE',
          fields: {
            productSku: 6969,
            productName: 'Agent Smith'
          }
        }
        const sender = partyD
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          sender
        )
        // expect(updatedPayment.payment.tokenBalanceA).to.equal(payment.balanceA.tokenDeposit.toString())
        // expect(updatedPayment.payment.tokenBalanceI).to.equal(payment.balanceB.tokenDeposit.toString())
        // expect(updatedPayment.payment.ethBalanceA).to.equal('0')
        // expect(updatedPayment.payment.ethBalanceI).to.equal('0')
      })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', function () {
    it('should fail if no payment object is provided', async () => {
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if null payment object is provided', async () => {
      const payment = null
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment is not an object', async () => {
      const payment = 'fail'
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment object is malformed', async () => {
      const payment = {
        fail: 'fail'
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.channelId doesnt exist', async () => {
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.channelId is null', async () => {
      const channelId = null
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.channelId is invalid', async () => {
      const channelId = 'fail'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceA doesnt exist', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceA is null', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = null
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceA is invalid type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = 'fail'
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceA is invalid object', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {}
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceA.tokenDeposit and payment.balanceA.ethDeposit are null', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: null,
        ethDeposit: null
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceA.tokenDeposit is an invalid type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: 'fail',
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
    it('should fail if payment.balanceA.tokenDeposit is negative type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('-0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceA.ethDeposit is an invalid type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: 'fail'
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceA.ethDeposit is negative', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('-0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB doesnt exist', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB is null', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = null
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB is invalid type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = 'fail'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB is invalid object', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {}
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB.tokenDeposit and payment.balanceB.ethDeposit are null', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: null,
        ethDeposit: null
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB.tokenDeposit is an invalid type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: 'fail',
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB.tokenDeposit is negative type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('-0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB.ethDeposit is an invalid type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: 'fail'
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payment.balanceB.ethDeposit is negative', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('-0.9', 'ether'))
      }
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no meta is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta is null', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = null
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta is not an object', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = 'fail'
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta is malformed', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {}
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta has no receiver', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.reciever is null', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: null,
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.reciever is not ETH address', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: 'fail',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.type doesnt exist', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.type is null', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: null,
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.type is invalid type', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'FAIL',
        fields: {
          productSku: 6969,
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields doesnt exist', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE'
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields is null', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: null
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields is malformed', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: 'fail'
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for PURCHASE is missing meta.productSKU', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productName: 'Agent Smith'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for PURCHASE has null meta.productSKU', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productName: 'Agent Smith',
          productSku: null
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for PURCHASE is missing meta.productName', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for PURCHASE has null meta.productName', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'PURCHASE',
        fields: {
          productSku: 6969,
          productName: null
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for TIP is missing meta.streamId', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'TIP',
        fields: {
          performerId: null,
          performerName: 'Marilyn Monbro'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for TIP has null meta.streamId', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'TIP',
        fields: {
          streamId: null,
          performerId: null,
          performerName: 'Marilyn Monbro'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for TIP is missing meta.performerId', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'TIP',
        fields: {
          streamId: 6969,
          performerName: 'Marilyn Monbro'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for TIP has null meta.performerId', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'TIP',
        fields: {
          streamId: 6969,
          performerId: null,
          performerName: 'Marilyn Monbro'
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for TIP is missing meta.performerName', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'TIP',
        fields: {
          streamId: 6969,
          performerId: 6969
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if meta.fields for TIP has null meta.performerName', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'TIP',
        fields: {
          streamId: 6969,
          performerId: 6969,
          performerName: null
        }
      }
      
      const sender = partyA
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
    
    it('should fail if invalid sender is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payment = {
        balanceA,
        balanceB,
        channelId
      }
      const meta = {
        receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
        type: 'TIP',
        fields: {
          streamId: 6969,
          performerId: 6969,
          performerName: 'performer a'
        }
      }
      
      const sender = 'fail'
      try {
        const updatedPayment = await client.channelUpdateHandler(
          { payment, meta },
          
          sender
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
