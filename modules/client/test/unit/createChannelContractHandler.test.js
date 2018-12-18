require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))
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

// for initial ledger channel states
let subchanAI, stubHub
describe('createChannelContractHandler()', () => {
  beforeEach('init client and create stubbed hub and contract', async () => {
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

    // stub contract methods
    client.channelManagerInstance.methods = createStubbedContract()

    // stub hub methods
    stubHub = await createStubbedHub(`${client.ingridUrl}`)
  })

  describe('stubbed contract and hub results', async () => {
    it('should call the stubbed contract handler and return correct results object', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const challenge = 3600
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const channelType = 'ETH'
      const results = await client.createChannelContractHandler({
        channelId,
        initialDeposits,
        challenge,
        channelType,
        tokenAddress: null,
        sender: partyA
      })
      expect(results.transactionHash).to.equal('transactionHash')
    })
  })

  describe('parameter validation', () => {
    it('should fail if no initialDeposits object is provided', async () => {
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits: null,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits is malformed', async () => {
      const initialDeposits = {
        fail: 'should fail'
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits contains null balances', async () => {
      const initialDeposits = {
        ethDeposit: null,
        tokenDeposit: null
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.ethDeposit is not a BN', async () => {
      const initialDeposits = {
        ethDeposit: 'fail',
        tokenDeposit: null
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.ethDeposit is negative', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN('-5'),
        tokenDeposit: null
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.tokenDeposit is not a BN', async () => {
      const initialDeposits = {
        tokenDeposit: 'fail',
        ethDeposit: null
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.tokenDeposit is negative', async () => {
      const initialDeposits = {
        tokenDeposit: Web3.utils.toBN('-5'),
        ethDeposit: null
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.tokenDeposit is negative and initialDeposits.ethDeposit is valid', async () => {
      const initialDeposits = {
        tokenDeposit: Web3.utils.toBN('-5'),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.ethDeposit is negative and initialDeposits.tokenDeposit is valid', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN('-5'),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.tokenDeposit is not BN and initialDeposits.ethDeposit is valid', async () => {
      const initialDeposits = {
        tokenDeposit: 'fail',
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.ethDeposit is not BN and initialDeposits.tokenDeposit is valid', async () => {
      const initialDeposits = {
        ethDeposit: 'fail',
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress: null,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid token address is supplied', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const tokenAddress = 'fail'
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid sender address is supplied', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const tokenAddress = client.contractAddress
      const sender = 'fail'
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress,
          sender
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid challenge period type is supplied', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const tokenAddress = client.contractAddress
      const challenge = 'fail'
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if negative challenge period is supplied', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const tokenAddress = client.contractAddress
      const challenge = -25
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no channelId is provided', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const tokenAddress = client.contractAddress
      const challenge = 3600
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId: null,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid channelId is provided', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const tokenAddress = client.contractAddress
      const challenge = 3600
      let channelId = 'fail'
      let channelType = 'ETH'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress,
          sender: partyA
        })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if invalid channelType is provided', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
      }
      const tokenAddress = client.contractAddress
      const challenge = 3600
      let channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      let channelType = 'fail'
      try {
        await client.createChannelContractHandler({
          channelId,
          initialDeposits,
          challenge,
          channelType,
          tokenAddress,
          sender: partyA
        })
      } catch (e) {
        expect(e.message).to.equal(
          '[400: createChannelContractHandler] Invalid channel type'
        )
      }
    })
  })
})
