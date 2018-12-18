require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))
const interval = require('interval-promise')
const { genAuthHash } = require('../helpers/utils')
const nock = require('nock')
const sinon = require('sinon')
const { createStubbedContract, createStubbedHub } = require('../helpers/stubs')
const TokenAbi = require('../../artifacts/SimpleToken.json')

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
let tokenAddress

// for accounts
let accounts
let partyA, partyB, partyC, partyD, partyE

// for initial ledger channel states
let subchanAI

describe('openChannel()', function () {
  this.timeout(120000)
  before('authenticate', async () => {
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

    // deploy token contract
    let simpleToken = new web3.eth.Contract(TokenAbi.abi)
    console.log('Deploying token contract...')
    simpleToken = await simpleToken
      .deploy({
        data: TokenAbi.bytecode
      })
      .send({
        from: accounts[0],
        gas: 1500000
      })
    console.log('Deployed token contract at:', simpleToken.options.address)
    tokenAddress = simpleToken.options.address

    console.log(
      'token balance 1:',
      await simpleToken.methods.balanceOf(accounts[2]).call({
        from: accounts[0]
      })
    )

    // fund accounts with tokens
    for (const account of accounts) {
      await simpleToken.methods
        .transfer(account, Web3.utils.toWei('500', 'ether'))
        .send({
          from: accounts[0]
        })
    }
    console.log(
      'token balance 2:',
      await simpleToken.methods.balanceOf(accounts[2]).call({
        from: accounts[0]
      })
    )
  })

  describe('mocked contract and hub happy case', () => {
    let stubHub, stub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()
      // stub contract methods
      client.channelManagerInstance.methods = createStubbedContract()

      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`, 'NO_LC')
    })

    it('should return create an ETH only subchanAI', async () => {
      stubHub
        .get(`/ledgerchannel/a/${partyA.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, {
          data: []
        })
      // control for lcId
      stub = sinon
        .stub(Connext, 'getNewChannelId')
        .returns(
          '0x1000000000000000000000000000000000000000000000000000000000000000'
        )
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: null
      }
      subchanAI = await client.openChannel(initialDeposits, null, partyA)
      expect(subchanAI).to.equal(
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(
        client.channelManagerInstance.methods.createChannel.calledOnce
      ).to.equal(true)
    })

    it('should return create an TOKEN only subchanAI', async () => {
      // control for lcId
      stub = sinon
        .stub(Connext, 'getNewChannelId')
        .returns(
          '0x2000000000000000000000000000000000000000000000000000000000000000'
        )
      const initialDeposits = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      subchanAI = await client.openChannel(
        initialDeposits,
        tokenAddress,
        partyA
      )
      expect(subchanAI).to.equal(
        '0x2000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(
        client.channelManagerInstance.methods.createChannel.calledOnce
      ).to.equal(true)
    })

    it('should return create an TOKEN/ETH subchanAI', async () => {
      // control for lcId
      stub = sinon
        .stub(Connext, 'getNewChannelId')
        .returns(
          '0x3000000000000000000000000000000000000000000000000000000000000000'
        )
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether')),
        tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      subchanAI = await client.openChannel(
        initialDeposits,
        tokenAddress,
        partyA
      )
      expect(subchanAI).to.equal(
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(
        client.channelManagerInstance.methods.createChannel.calledOnce
      ).to.equal(true)
    })

    afterEach('restore hub', () => {
      Connext.getNewChannelId.restore()
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', () => {
    it('should fail if no initialDeposits object is provided', async () => {
      try {
        await client.openChannel()
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits is malformed', async () => {
      const initialDeposits = {
        fail: 'should fail'
      }
      try {
        await client.openChannel(initialDeposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits contains null balances', async () => {
      const initialDeposits = {
        ethDeposit: null,
        tokenDeposit: null
      }
      try {
        await client.openChannel(initialDeposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.ethDeposit is not a BN', async () => {
      const initialDeposits = {
        ethDeposit: 'fail',
        tokenDeposit: null
      }
      try {
        await client.openChannel(initialDeposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if initialDeposits.ethDeposit is negative', async () => {
      const initialDeposits = {
        ethDeposit: Web3.utils.toBN('-5'),
        tokenDeposit: null
      }
      try {
        await client.openChannel(initialDeposits)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })

  it('should fail if initialDeposits.tokenDeposit is not a BN', async () => {
    const initialDeposits = {
      tokenDeposit: 'fail',
      ethDeposit: null
    }
    try {
      await client.openChannel(initialDeposits)
    } catch (e) {
      expect(e.statusCode).to.equal(200)
    }
  })

  it('should fail if initialDeposits.tokenDeposit is negative', async () => {
    const initialDeposits = {
      tokenDeposit: Web3.utils.toBN('-5'),
      ethDeposit: null
    }
    try {
      await client.openChannel(initialDeposits)
    } catch (e) {
      expect(e.statusCode).to.equal(200)
    }
  })

  it('should fail if initialDeposits.tokenDeposit is negative and initialDeposits.ethDeposit is valid', async () => {
    const initialDeposits = {
      tokenDeposit: Web3.utils.toBN('-5'),
      ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
    }
    try {
      await client.openChannel(initialDeposits)
    } catch (e) {
      expect(e.statusCode).to.equal(200)
    }
  })

  it('should fail if initialDeposits.ethDeposit is negative and initialDeposits.tokenDeposit is valid', async () => {
    const initialDeposits = {
      ethDeposit: Web3.utils.toBN('-5'),
      tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
    }
    try {
      await client.openChannel(initialDeposits)
    } catch (e) {
      expect(e.statusCode).to.equal(200)
    }
  })

  it('should fail if initialDeposits.tokenDeposit is not BN and initialDeposits.ethDeposit is valid', async () => {
    const initialDeposits = {
      tokenDeposit: 'fail',
      ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
    }
    try {
      await client.openChannel(initialDeposits)
    } catch (e) {
      expect(e.statusCode).to.equal(200)
    }
  })

  it('should fail if initialDeposits.ethDeposit is not BN and initialDeposits.tokenDeposit is valid', async () => {
    const initialDeposits = {
      ethDeposit: 'fail',
      tokenDepsit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
    }
    try {
      await client.openChannel(initialDeposits)
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
    try {
      await client.openChannel(initialDeposits, tokenAddress)
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
    try {
      await client.openChannel(initialDeposits, tokenAddress, sender)
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
    const sender = partyA
    const challenge = 'fail'
    try {
      await client.openChannel(initialDeposits, tokenAddress, sender, challenge)
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
    const sender = partyA
    const challenge = -25
    try {
      await client.openChannel(initialDeposits, tokenAddress, sender, challenge)
    } catch (e) {
      expect(e.statusCode).to.equal(200)
    }
  })
})
