require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const nock = require('nock')
const { createStubbedHub } = require('../helpers/stubs')
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

describe('getChannelTimer()', function () {
  describe('stubbed hub methods', () => {
    let stubHub
    beforeEach('init client and create stubs', async () => {
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

      // activate nock
      if (!nock.isActive()) nock.activate()
      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`)
      // update get open lc to return null
      stubHub
        .get(`/ledgerchannel/a/${partyA.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, {
          data: []
        })
    })

    it('should return 3600', async () => {
      const timer = await client.getChallengeTimer()
      expect(timer).to.equal(3600)
    })

    afterEach('restore hub/Connext', () => {
      nock.restore()
      nock.cleanAll()
    })
  })
})
