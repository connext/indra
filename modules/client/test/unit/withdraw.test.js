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

describe('closeChannel()', () => {
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
        'OPEN_LC_CLOSED_VC',
        'UPDATED'
      )
    })

    it('should closeChannel from the ETH/TOKEN channel', async () => {
      const response = await client.closeChannel(partyA)
      expect(response).to.equal('transactionHash')
    })

    it('should closeChannel from the ETH/TOKEN recipient channel', async () => {
      const response = await client.closeChannel(partyB)
      expect(response).to.equal('transactionHash')
    })

    it('should closeChannel from the ETH channel', async () => {
      const response = await client.closeChannel(partyC)
      expect(response).to.equal('transactionHash')
    })

    it('should closeChannel from the TOKEN channel', async () => {
      const response = await client.closeChannel(partyD)
      expect(response).to.equal('transactionHash')
    })

    afterEach('restore hub and contract', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if an invalid sender is provided', async () => {
      try {
        await client.closeChannel('fail')
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
