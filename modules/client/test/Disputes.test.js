require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const assert = require('assert')
const Connext = require('../src/Connext')
const { timeout, genAuthHash } = require('./helpers/utils')
const Web3 = require('web3')
const sinon = require('sinon')

const fetch = require('fetch-cookie')(require('node-fetch'))

global.fetch = fetch

// named variables
// on init
let web3
let client
let ingridAddress
let watcherUrl = process.env.WATCHER_URL || ''
let ingridUrl = process.env.INGRID_URL || 'http://localhost:8080'
let contractAddress = '0x31713144d9ae2501e644a418dd9035ed840b1660'

// for accounts
let accounts
let partyA, partyB

// for initial ledger channel states
let subchanAI, subchanBI
let lcA, lcB
let balanceA, balanceB
let initialDeposit = Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
let vcId
let vc

describe('Connext dispute cases', function () {
  this.timeout(120000)

  // before, should init client with LCs and VC
  before(
    'Should init client and openChannel partyA and partyB with the hub, and create/update a VC between them',
    async () => {
      console.log('Initing client..')
      // init web3
      const port = process.env.ETH_PORT ? process.env.ETH_PORT : '8545'
      web3 = new Web3(`ws://localhost:${port}`)
      // set account vars
      accounts = await web3.eth.getAccounts()
      ingridAddress = accounts[0]
      partyA = accounts[1]
      partyB = accounts[2]
      // generate hub auth
      const origin = 'localhost'

      const challengeRes = await fetch(`${ingridUrl}/auth/challenge`, {
        method: 'POST',
        credentials: 'include'
      })
      const challengeJson = await challengeRes.json()
      const nonce = challengeJson.nonce

      const hash = genAuthHash(nonce, origin)
      const signature = await web3.eth.sign(hash, ingridAddress)

      const authRes = await fetch(`${ingridUrl}/auth/response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin
        },
        credentials: 'include',
        body: JSON.stringify({
          signature,
          nonce,
          origin,
          address: ingridAddress.toLowerCase()
        })
      })

      const authJson = await authRes.json()

      expect(authJson).to.not.equal({})
      // init client instance
      client = new Connext({
        web3,
        ingridAddress,
        watcherUrl,
        ingridUrl,
        contractAddress
      })
      console.log('Client properly initialized')

      console.log('Creating/Fetching channels with hub..')
      // openChannel partyA if lcA doesnt exist
      lcA = await client.getChannelByPartyA(partyA)
      if (lcA == null) {
        subchanAI = await client.openChannel(initialDeposit, partyA, 15)
        await timeout(30000) // wait for chainsaw and autojoin
        lcA = await client.getChannelByPartyA(partyA)
      } else {
        subchanAI = lcA.channelId
      }
      // openChannel partyB if lcB doesnt exist
      lcB = await client.getChannelByPartyA(partyB)
      if (lcB == null) {
        subchanBI = await client.openChannel(initialDeposit, partyB, 15)
        await timeout(30000) // wait for chainsaw and autojoin
        lcB = await client.getChannelByPartyA(partyA)
      } else {
        subchanBI = lcB.channelId
      }
      // if insufficient funds, request ingrid deposit into subchanBI
      console.log('Ensuring sufficient balances in hub channels..')
      // refetch channels
      lcA = await client.getChannelByPartyA(partyA)
      lcB = await client.getChannelByPartyA(partyB)
      if (
        Web3.utils
          .toBN(lcB.balanceI)
          .lt(Web3.utils.toBN(Web3.utils.toWei('1', 'ether')))
      ) {
        await client.requestHubDeposit({
          lcId: subchanBI,
          deposit: initialDeposit
        })
        await timeout(30000) // wait for chainsaw
      }
      // if insufficient funds in lcA.balanceA to open channel deposit
      if (
        Web3.utils
          .toBN(lcA.balanceA)
          .lt(Web3.utils.toBN(Web3.utils.toWei('1', 'ether')))
      ) {
        await client.deposit(initialDeposit, partyA)
        await timeout(30000) // wait for chainsaw
      }

      // create/update VC between partyA and partyB if doesnt exist
      console.log('Creating/Updating or Fetching thread between A and B..')
      vc = await client.getThreadByParties({ partyA, partyB })
      if (vc == null) {
        vcId = await client.openThread({
          to: partyB,
          deposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
          sender: partyA
        })
        vc = await client.getThreadById(vcId)
        // update VC 3x
        balanceA = Web3.utils.toBN(vc.balanceA)
        balanceB = Web3.utils.toBN(vc.balanceB)
        for (let i = 0; i < 3; i++) {
          balanceA = balanceA.sub(
            Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
          )
          balanceB = balanceB.add(
            Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
          )
          await client.updateBalance({
            channelId: vcId,
            balanceA,
            balanceB
          })
        }
      } else {
        vcId = vc.channelId
        balanceA = Web3.utils.toBN(vc.balanceA)
        balanceB = Web3.utils.toBN(vc.balanceB)
      }
      console.log('Channels and threads created, begining tests..')
    }
  )

  describe('hub does not join ledger channel', function () {
    this.timeout(120000)
    // ***** TEMPLATE ******
    // it('should call LCOpenTimeout if channel never joined', async () => {
    //   if (lcA.timeout < Date.now()) {
    //     await client.ChannelOpenTimeoutContractHandler(subchanAI, partyA)
    //   }
    // })
  })

  describe('hub does not countersign closing vc update', function () {
    this.timeout(120000)

    it('should closeThread without returning fastSig', async () => {
      // mock response from hub for client.fastCloseVCHandler
      let stub = sinon.stub(client, 'fastCloseVCHandler').returns(false)

      // to not return fast close
      try {
        await client.closeThread(vcId)
      } catch (e) {
        expect(e.statusCode).to.equal(651)
      }
      expect(stub.calledOnce).to.be.true
    })

    it('should call initVcStateContractHandler', async () => {
      // get initial vc state
      let vc0 = await client.getThreadInitialState(vcId)
      // init on chain
      const response = await client.initVcStateContractHandler({
        subchanId: subchanAI, // caller subchan
        vcId,
        nonce: 0,
        partyA,
        partyB, // also in vc0 obj
        balanceA: Web3.utils.toBN(vc0.balanceA),
        balanceB: Web3.utils.toBN(vc0.balanceB), // should always be 0
        sigA: vc0.sigA,
        sender: partyA // optional, for testing
      })

      // response should be tx hash
      const tx = await client.web3.eth.getTransaction(response.transactionHash)

      // assert tx was successfully submitted
      expect(tx.from).to.equal(partyA)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
    })

    it('should call settleVCContractHandler', async () => {
      // get latest vc state
      let vcN = await client.getLatestVCStateUpdate(vcId)
      const response = await client.settleVcContractHandler({
        subchanId: subchanAI, // callers subchan
        vcId,
        nonce: vcN.nonce,
        partyA,
        partyB, // also in vcN obj
        balanceA: Web3.utils.toBN(vcN.balanceA),
        balanceB: Web3.utils.toBN(vcN.balanceB),
        sigA: vcN.sigA,
        sender: partyA // optional, default accounts[0]
      })
      // response should be tx hash
      const tx = await client.web3.eth.getTransaction(response.transactionHash)

      // assert tx was successfully submitted
      expect(tx.from).to.equal(partyA)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      // // assert vc status chained
      // await timeout(15000) // wait for chainsaw to change channel status
      // vc = await client.getThreadById(vcId)
      // expect(vc.state).to.equal(2) // settling
    })

    it('should wait out challenge period and call closeVirtualChannelContractHandler', async () => {
      // should not need to await, challenge set to 15 sec on test
      // right now there is no way to get the challenge timeout info, but well add it like this:
      // while (vc.challengeTimeout < Date.now()) {
      //   await timeout(3000)
      //   vc = await client.getThreadById(vcId)
      // }

      await timeout(16000)
      const response = await client.closeVirtualChannelContractHandler({
        lcId: subchanAI, // senders subchan
        vcId,
        sender: partyA // optional, defaults to accounts[0]
      })
      // response should be tx hash
      const tx = await client.web3.eth.getTransaction(response.transactionHash)

      // assert tx was successfully submitted
      expect(tx.from).to.equal(partyA)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      // should also increase lcA balance on chain
      // but this is probably broken by chainsaw atm so test l8r
    })

    it('should be able to settle multiple VCs on chain', async () => {})

    it('should not interrupt other VCs', async () => {})

    it('should not prohibit VCs from opening', async () => {})
  })

  describe.only('hub did not countersign closing lc update', function () {
    this.timeout(120000)

    let response

    it('should close virtual channels', async () => {
      await client.closeThread(vcId)
      // get vcA
      vc = await client.getThreadById(vcId)
      assert.equal(vc.state, 3)
    })

    it('should call closeChannel without i-countersiging closing update', async () => {
      const latestState = await client.getLatestChannelState(subchanAI, [
        'sigI'
      ])
      // mock response from hub for client.fastCloseLCHandler
      let fastCloseLcStub = sinon.stub(client, 'fastCloseLcHandler').returns({
        sigI: ''
      }) // hub doesnt cosign
      response = await client.closeChannel(partyA)
      console.log(response)
      expect(fastCloseLcStub.calledOnce).to.be.true
      expect(response.fastClosed).to.equal(false)
    })

    it('should have called updateLCState on chain and sent lc into challenge state', async () => {
      // response.response should be tx obj
      const tx = await client.web3.eth.getTransaction(
        response.response.transactionHash
      )
      // subchanAI =
      //   '0x6fb0fc92d0ce9a838eae4b902a9e3dca2e2133a6f7ae04a4058cbd22e446cc25'

      // const tx = await client.web3.eth.getTransaction(
      //   '0xfd727784d6bfabd98d61d573582deb4e2a0da24dc9c56e6b831209df5da63ed0'
      // )

      // assert tx was successfully submitted
      expect(tx.from).to.equal(partyA)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)

      await timeout(20000) // wait for chainsaw to pick up settled state change
      lcA = await client.getChannelById(subchanAI)
      expect(lcA.state).to.equal(2) // settling
    })

    it('should wait out challenge period and call withdraw', async () => {
      // subchanAI =
      //   '0x6fb0fc92d0ce9a838eae4b902a9e3dca2e2133a6f7ae04a4058cbd22e446cc25'
      // already awaited, should not have to again
      // while (lcA.challengeTimeout < Date.now()) {
      //   await timeout(3000)
      //   lcA = await client.getChannelById(subchanAI)
      // }
      // get previous balances
      const prevBalA = await client.web3.eth.getBalance(partyA)
      const prevBalI = await client.web3.eth.getBalance(ingridAddress)

      const response = await client.withdraw(partyA)
      console.log(response)
      const tx = await client.web3.eth.getTransaction(response.transactionHash)

      // assert tx was successfully submitted
      expect(tx.from).to.equal(partyA)
      expect(tx.to).to.equal(client.contractAddress)
      // assert account balances increased
      const expectedA = Web3.utils.fromWei(
        Web3.utils.toBN(lcA.balanceA).add(Web3.utils.toBN(prevBalA)),
        'ether'
      )
      const expectedI = Web3.utils.fromWei(
        Web3.utils.toBN(lcA.balanceI).add(Web3.utils.toBN(prevBalI)),
        'ether'
      )
      const finalBalA = Web3.utils.fromWei(
        await client.web3.eth.getBalance(partyA),
        'ether'
      )
      const finalBalI = Web3.utils.fromWei(
        await client.web3.eth.getBalance(ingridAddress),
        'ether'
      )
      expect(Math.round(expectedA)).to.equal(Math.round(finalBalA))
      expect(Math.round(expectedI)).to.equal(Math.round(finalBalI))
    })
  })

  describe('partyA takes VC to chain with earlier nonce', () => {
    describe('hub handles the dispute', async () => {
      it('partyA should call initVC onchain', async () => {})

      it('partyA should call settleVC onchain with nonce = 1', async () => {})

      it('hub should call settleVC with latest nonce', async () => {})

      it('should wait out challenge period and call closeVirtualChannel on chain', async () => {})
    })

    describe('watcher handles the dispute after hub fails to respond to dispute in time', async () => {
      it('partyA should call initVC onchain', async () => {})

      it('partyA should call settleVC onchain with nonce = 1', async () => {})

      it('hub should call settleVC with latest nonce', async () => {})

      it('should wait out challenge period and call closeVirtualChannel on chain', async () => {})
    })
  })

  describe('partyA takes LC to chain with earlier nonce', () => {
    describe('hub handles the dispute', () => {
      it('partyA calls updateLCState on chain with nonce = 1', async () => {})

      it('hub should call updateLCState with latest state', async () => {})

      it('should wait out challenge period and call byzantinecloseThread on chain', async () => {})
    })

    describe('watcher handles the dispute after hub fails to respond', () => {
      it('partyA calls updateLCState on chain with nonce = 1', async () => {})

      it('hub should call updateLCState with latest state', async () => {})

      it('should wait out challenge period and call byzantinecloseThread on chain', async () => {})
    })
  })

  describe('Ingrid failed to autojoin an LC', () => {
    it(
      'watchers should call VCOpenTimeout on chain, and increase acct balance of partyA'
    )
  })
})
