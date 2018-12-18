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

describe('createChannelUpdateOnThreadOpen()', () => {
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

  describe('mocked hub and contract', () => {
    let stubHub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()
      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`, 'OPEN_LC_NO_VC')
    })

    it('should correctly generate and sign a channel update representing opening a new ETH/TOKEN thread', async () => {
      const channel = await client.getChannelByPartyA(partyA)
      const threadInitialState = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        partyA: partyA.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        balanceA: {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
        },
        balanceB: {
          ethDeposit: Web3.utils.toBN('0'),
          tokenDeposit: Web3.utils.toBN('0')
        },
        nonce: 0
      }
      const signer = partyA
      const sigAtoI = await client.createChannelUpdateOnThreadOpen({
        threadInitialState,
        channel,
        signer
      })
      const sigParams = {
        sig: sigAtoI,
        isClose: false,
        channelId: channel.channelId,
        nonce: 1,
        openVcs: 1,
        vcRootHash: Connext.generateThreadRootHash({
          threadInitialStates: [threadInitialState]
        }),
        partyA,
        partyI: ingridAddress,
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
      }
      const trueSigner = Connext.recoverSignerFromChannelStateUpdate(sigParams)
      expect(trueSigner.toLowerCase()).to.equal(partyA.toLowerCase())
    })

    it('should correctly generate and sign a channel update representing opening a new ETH thread', async () => {
      const channel = await client.getChannelByPartyA(partyA)
      const threadInitialState = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        partyA: partyA.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        balanceA: {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
        },
        balanceB: {
          ethDeposit: Web3.utils.toBN('0'),
          tokenDeposit: Web3.utils.toBN('0')
        },
        nonce: 0
      }
      const signer = partyA
      const sigAtoI = await client.createChannelUpdateOnThreadOpen({
        threadInitialState,
        channel,
        signer
      })
      const sigParams = {
        sig: sigAtoI,
        isClose: false,
        channelId: channel.channelId,
        nonce: 1,
        openVcs: 1,
        vcRootHash: Connext.generateThreadRootHash({
          threadInitialStates: [threadInitialState]
        }),
        partyA,
        partyI: ingridAddress,
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
      }
      const trueSigner = Connext.recoverSignerFromChannelStateUpdate(sigParams)
      expect(trueSigner.toLowerCase()).to.equal(partyA.toLowerCase())
    })

    it('should correctly generate and sign a channel update representing opening a new TOKEN thread', async () => {
      const channel = await client.getChannelByPartyA(partyA)
      const threadInitialState = {
        channelId: '0x0100000000000000000000000000000000000000000000000000000000000000',
        partyA: partyA.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        balanceA: {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
        },
        balanceB: {
          ethDeposit: Web3.utils.toBN('0'),
          tokenDeposit: Web3.utils.toBN('0')
        },
        nonce: 0
      }
      const signer = partyA
      const sigAtoI = await client.createChannelUpdateOnThreadOpen({
        threadInitialState,
        channel,
        signer
      })
      const sigParams = {
        sig: sigAtoI,
        isClose: false,
        channelId: channel.channelId,
        nonce: 1,
        openVcs: 1,
        vcRootHash: Connext.generateThreadRootHash({
          threadInitialStates: [threadInitialState]
        }),
        partyA,
        partyI: ingridAddress,
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
      }
      const trueSigner = Connext.recoverSignerFromChannelStateUpdate(sigParams)
      expect(trueSigner.toLowerCase()).to.equal(partyA.toLowerCase())
    })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  // TO DO: add parameter validation tests
  describe('parameter validation', () => {})
})
