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

describe('createChannelStateUpdate()', function () {
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

  describe('mocked hub', () => {
    let stubHub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()

      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`, 'OPEN_LC_NO_VC')
    })

    it('should sign a TOKEN/ETH state update', async () => {
      const update = {
        channelId: '0x1000000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA,
        partyI: ingridAddress,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
        },
        balanceI: {
          tokenDeposit: Web3.utils.toBN('0'),
          ethDeposit: Web3.utils.toBN('0')
        },
        signer: partyA
      }
      const sig = await client.createChannelStateUpdate(update)
      const signer = Connext.recoverSignerFromChannelStateUpdate({
        channelId: update.channelId,
        sig,
        isClose: false,
        nonce: update.nonce,
        openVcs: update.openVcs,
        vcRootHash: update.vcRootHash,
        partyA,
        partyI: update.partyI,
        ethBalanceA: update.balanceA.ethDeposit,
        ethBalanceI: update.balanceI.ethDeposit,
        tokenBalanceI: update.balanceI.tokenDeposit,
        tokenBalanceA: update.balanceA.tokenDeposit
      })
      expect(signer.toLowerCase()).to.equal(partyA.toLowerCase())
    })

    it('should sign a ETH state update', async () => {
      const update = {
        channelId: '0x3000000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyC,
        partyI: ingridAddress,
        balanceA: {
          tokenDeposit: null,
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
        },
        balanceI: {
          tokenDeposit: null,
          ethDeposit: Web3.utils.toBN('0')
        },
        signer: partyC
      }
      const sig = await client.createChannelStateUpdate(update)
      const signer = Connext.recoverSignerFromChannelStateUpdate({
        channelId: update.channelId,
        sig,
        isClose: false,
        nonce: update.nonce,
        openVcs: update.openVcs,
        vcRootHash: update.vcRootHash,
        partyA: partyC,
        partyI: update.partyI,
        ethBalanceA: update.balanceA.ethDeposit,
        ethBalanceI: update.balanceI.ethDeposit,
        tokenBalanceI: Web3.utils.toBN('0'),
        tokenBalanceA: Web3.utils.toBN('0')
      })
      expect(signer.toLowerCase()).to.equal(partyC.toLowerCase())
    })

    it('should sign a TOKEN state update', async () => {
      const update = {
        channelId: '0x4000000000000000000000000000000000000000000000000000000000000000',
        nonce: 0,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyD,
        partyI: ingridAddress,
        balanceA: {
          tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
          ethDeposit: null
        },
        balanceI: {
          tokenDeposit: Web3.utils.toBN('0'),
          ethDeposit: null
        },
        signer: partyD
      }
      const sig = await client.createChannelStateUpdate(update)
      const signer = Connext.recoverSignerFromChannelStateUpdate({
        channelId: update.channelId,
        sig,
        isClose: false,
        nonce: update.nonce,
        openVcs: update.openVcs,
        vcRootHash: update.vcRootHash,
        partyA: partyD,
        partyI: update.partyI,
        ethBalanceA: Web3.utils.toBN('0'),
        ethBalanceI: Web3.utils.toBN('0'),
        tokenBalanceI: update.balanceI.tokenDeposit,
        tokenBalanceA: update.balanceA.tokenDeposit
      })
      expect(signer.toLowerCase()).to.equal(partyD.toLowerCase())
    })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })
  })
})
