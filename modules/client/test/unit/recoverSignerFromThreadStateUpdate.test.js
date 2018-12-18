require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))

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

describe('recoverSignerFromThreadStateUpdate()', function () {
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

  it('should generate a hash of the input data using Web3', async () => {
    let state = {
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
    const sig = await client.web3.eth.sign(hash, partyA)
    state.sig = sig
    const signer = Connext.recoverSignerFromThreadStateUpdate(state)
    expect(signer.toLowerCase()).to.equal(partyA.toLowerCase())
  })

  describe('parameter validation', () => {
    it('should fail if it is missing sig', () => {
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
    it('should fail if sig is null', () => {
      const state = {
        sig: null,
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
    it('should fail if sig is invalid', () => {
      const state = {
        sig: 'fail',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if it is missing channelId', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if channelId is null', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if channelId is invalid', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if it is missing nonce', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if nonce is null', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
    it('should fail if nonce is invalid', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no partyA', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyA is null', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyA is invalid', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB doesnt exist', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB is null', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if partyB is invalid', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB: 'fail',
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceA doesnt exist', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceA is null', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceA is invalid', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceB doesnt exist', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceA: Web3.utils.toBN('1000'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceB is null', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if ethBalanceB is invalid', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceA doesnt exist', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceB: Web3.utils.toBN('0')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceA is null', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceA is invalid', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceB doesnt exist', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        partyA,
        partyB,
        ethBalanceA: Web3.utils.toBN('1000'),
        ethBalanceB: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('1000')
      }
      try {
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceB is null', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if tokenBalanceB is invalid', () => {
      const state = {
        sig: '0x0100000000000000000000000000000000000000000000000000000000000000',
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
        Connext.recoverSignerFromThreadStateUpdate(state)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })
})
