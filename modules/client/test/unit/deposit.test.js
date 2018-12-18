require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))
const sinon = require('sinon')
const nock = require('nock')
const { createStubbedHub, createStubbedContract } = require('../helpers/stubs')
const TokenAbi = require('../../artifacts/SimpleToken.json')
const Connext = require('../../src/Connext')

// named variables
// on init
const web3 = new Web3('http://localhost:8545')
let client
let ingridAddress
let partyA
let ingridUrl = 'http://localhost:8080'
let contractAddress = '0xdec16622bfe1f0cdaf6f7f20437d2a040cccb0a1'
let watcherUrl = ''
let accounts
let tokenAddress

describe('deposit()', function () {
  this.timeout(120000)
  before('init client and create stubbed hub and contract', async () => {
    accounts = await web3.eth.getAccounts()
    ingridAddress = accounts[0]
    partyA = accounts[1]
    const authJson = { token: 'SwSNTnh3LlEJg1N9iiifFgOIKq998PGA' }

    // init client instance
    client = new Connext({
      web3,
      ingridAddress,
      watcherUrl,
      ingridUrl,
      contractAddress
    })

    // deploy token contract
    let simpleToken = new web3.eth.Contract(TokenAbi.abi)
    console.log('Deploying token contract...')
    simpleToken = await simpleToken
      .deploy({
        data: TokenAbi.bytecode
      })
      .send({
        from: accounts[0],
        gas: 1500000
      })
    console.log('Deployed token contract at:', simpleToken.options.address)
    tokenAddress = simpleToken.options.address
    // fund accounts with tokens
    for (const account of accounts) {
      await simpleToken.methods
        .transfer(account, Web3.utils.toWei('500', 'ether'))
        .send({
          from: accounts[0]
        })
    }
  })

  describe('stubbed hub/contract tests', () => {
    let stubHub, stub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()
      // stub contract methods
      client.channelManagerInstance.methods = createStubbedContract()

      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`, 'OPEN_LC_NO_VC')
    })

    it('should create an ETH only deposit', async () => {
      const deposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        tokenDeposit: null
      }
      const result = await client.deposit(
        deposits,
        partyA,
        partyA,
        tokenAddress
      )
      expect(client.channelManagerInstance.methods.deposit.calledOnce).to.equal(
        true
      )
    })

    it('should create an TOKEN only deposit', async () => {
      const deposits = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const result = await client.deposit(
        deposits,
        partyA,
        partyA,
        tokenAddress
      )
      expect(client.channelManagerInstance.methods.deposit.calledOnce).to.equal(
        true
      )
    })

    it('should create an ETH/TOKEN deposit', async () => {
      const deposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const result = await client.deposit(
        deposits,
        partyA,
        partyA,
        tokenAddress
      )
      expect(client.channelManagerInstance.methods.deposit.calledOnce).to.equal(
        true
      )
    })

    afterEach('restore hub/contract', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if no deposits object is provided', async () => {
      try {
        await client.deposit()
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits is malformed', async () => {
      const deposits = {
        fail: 'should fail'
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits contains null balances', async () => {
      const deposits = {
        ethDeposit: null,
        tokenDeposit: null
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits.ethDeposit is not a BN', async () => {
      const deposits = {
        ethDeposit: 'fail',
        tokenDeposit: null
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits.ethDeposit is negative', async () => {
      const deposits = {
        ethDeposit: Web3.utils.toBN('-5'),
        tokenDeposit: null
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits.tokenDeposit is not a BN', async () => {
      const deposits = {
        ethDeposit: null,
        tokenDeposit: 'fail'
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits.tokenDeposit is negative', async () => {
      const deposits = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN('-5')
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits.tokenDeposit is negative and deposits.ethDeposit is valid', async () => {
      const deposits = {
        ethDeposit: Web3.utils.toBN('5'),
        tokenDeposit: Web3.utils.toBN('-5')
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits.ethDeposit is negative and deposits.tokenDeposit is valid', async () => {
      const deposits = {
        ethDeposit: Web3.utils.toBN('-5'),
        tokenDeposit: Web3.utils.toBN('5')
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits.tokenDeposit is not BN and deposits.ethDeposit is valid', async () => {
      const deposits = {
        ethDeposit: Web3.utils.toBN('5'),
        tokenDeposit: 'fail'
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposits.ethDeposit is not BN and deposits.tokenDeposit is valid', async () => {
      const deposits = {
        ethDeposit: 'fail',
        tokenDeposit: Web3.utils.toBN('-5')
      }
      try {
        await client.createChannelContractHandler(deposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid sender address is supplied', async () => {
      const deposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const sender = 'fail'
      try {
        await client.deposit(deposits, sender)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid recipient address is supplied', async () => {
      const deposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const recipient = 'fail'
      try {
        await client.deposit(deposits, partyA, recipient)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
