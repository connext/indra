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

describe('closeThreads()', () => {
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

    it('should close the channels with the given threadIds', async () => {
      const threadId1 =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadId2 =
        '0x0200000000000000000000000000000000000000000000000000000000000000'
      const threadId3 =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const channelIds = [threadId1, threadId2, threadId3]
      const response = await client.closeThreads(channelIds, partyB)
      expect(response.length).to.equal(3)
    })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })

    describe('parameter validation', async () => {
      it('should fail if no channelIds are provided', async () => {
        try {
          await client.closeThreads()
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if null channelIds are provided', async () => {
        const channelIds = null
        try {
          await client.closeThreads(channelIds)
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if invalid channelIds are provided', async () => {
        const channelIds = null
        try {
          await client.closeThreads(channelIds)
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if provided channelIds is not an array', async () => {
        const channelIds = {}
        try {
          await client.closeThreads(channelIds)
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })

      it('should fail if an invalid sender is provided', async () => {
        const channelIds = [
          '0x0100000000000000000000000000000000000000000000000000000000000000'
        ]
        const sender = 'fail'
        try {
          await client.closeThreads(channelIds, sender)
        } catch (e) {
          expect(e.statusCode).to.equal(200)
        }
      })
    })
  })
})
