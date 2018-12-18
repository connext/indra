require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))
const { createStubbedHub } = require('../helpers/stubs')
const nock = require('nock')
const sinon = require('sinon')

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

describe('openThread()', function () {
  before('init client and accounts', async () => {
    accounts = await web3.eth.getAccounts()
    ingridAddress = accounts[0]
    partyA = accounts[1]
    partyB = accounts[2]
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
    let stubHub, stub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()

      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`, 'OPEN_LC_NO_VC')
    })

    it('should create a new virtual channel', async () => {
      stub = sinon
        .stub(Connext, 'getNewChannelId')
        .returns(
          '0x0100000000000000000000000000000000000000000000000000000000000000'
        )
      const to = partyB
      const deposit = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const channelId = await client.openThread({
        to,
        deposit,
        sender: partyA
      })
      expect(channelId).to.equal(
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      )
      expect(Connext.getNewChannelId.calledOnce).to.equal(true)
    })

    afterEach('restore hub', () => {
      Connext.getNewChannelId.restore()
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if no to is supplied', async () => {
      const deposit = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      try {
        await client.openThread({ deposit, sender: partyA })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if to is null', async () => {
      const to = null
      const deposit = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      try {
        await client.openThread({ to, deposit, sender: partyA })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if to is invalid', async () => {
      const to = 'fail'
      const deposit = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      try {
        await client.openThread({ to, deposit, sender: partyA })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposit is invalid', async () => {
      const to = partyB
      const deposit = 'fail'
      try {
        await client.openThread({ to, deposit, sender: partyA })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposit.tokenDeposit is invalid', async () => {
      const to = 'fail'
      const deposit = {
        tokenDeposit: 'fail',
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      try {
        await client.openThread({ to, deposit, sender: partyA })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposit.ethDeposit is invalid', async () => {
      const to = 'fail'
      const deposit = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: 'fail'
      }
      try {
        await client.openThread({ to, deposit, sender: partyA })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposit has 2 null fields', async () => {
      const to = 'fail'
      const deposit = {
        tokenDeposit: null,
        ethDeposit: null
      }
      try {
        await client.openThread({ to, deposit, sender: partyA })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if deposit has 2 0 fields', async () => {
      const to = 'fail'
      const deposit = {
        tokenDeposit: Web3.utils.toBN('0'),
        ethDeposit: Web3.utils.toBN('0')
      }
      try {
        await client.openThread({ to, deposit, sender: partyA })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if sender is invalid', async () => {
      const to = partyB
      const deposit = {
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      try {
        await client.openThread({ to, deposit, sender: 'fail' })
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
