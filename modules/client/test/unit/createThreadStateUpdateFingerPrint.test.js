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
let partyA
let partyB

describe('createThreadStateUpdateFingerprint()', function () {
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

  it('should generate a hash of the input data using Web3', () => {
    const state = {
      channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
      nonce: 0,
      partyA,
      partyB,
      ethBalanceA: Web3.utils.toBN('1000'),
      ethBalanceB: Web3.utils.toBN('0'),
      tokenBalanceA: Web3.utils.toBN('1000'),
      tokenBalanceB: Web3.utils.toBN('0')
    }
    const hash = Connext.createThreadStateUpdateFingerprint(state)
    const hubBondEth = state.ethBalanceA.add(state.ethBalanceB)
    const hubBondToken = state.tokenBalanceA.add(state.tokenBalanceB)
    const expectedHash = Web3.utils.soliditySha3(
      { type: 'bytes32', value: state.channelId },
      { type: 'uint256', value: state.nonce },
      { type: 'address', value: state.partyA },
      { type: 'address', value: state.partyB },
      { type: 'uint256', value: hubBondEth },
      { type: 'uint256', value: hubBondToken },
      { type: 'uint256', value: state.ethBalanceA },
      { type: 'uint256', value: state.ethBalanceB },
      { type: 'uint256', value: state.tokenBalanceA },
      { type: 'uint256', value: state.tokenBalanceB }
    )
    expect(hash).to.equal(expectedHash)
  })

  describe('parameter validation', () => {
    it('should fail if it is missing channelId', () => {
      const state = {
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if channelId is null', () => {
      const state = {
        channelId: null,
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if channelId is invalid', () => {
      const state = {
        channelId: 'fail',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if it is missing nonce', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if nonce is null', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: null,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
    it('should fail if nonce is invalid', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 'fail',
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no partyA', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyA is null', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA: null,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyA is invalid', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA: 'fail',
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB doesnt exist', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB is null', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB: null,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB is invalid', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceA doesnt exist', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceA is null', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: null,
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceA is invalid', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: 'fail',
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceB doesnt exist', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceB is null', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: null,
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceB is invalid', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: 'fail',
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceA doesnt exist', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceA is null', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: null,
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceA is invalid', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: 'fail',
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceB doesnt exist', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000')
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceB is null', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: null
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceB is invalid', () => {
      const state = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: 'fail'
      }
      try {
        Connext.createThreadStateUpdateFingerprint(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
