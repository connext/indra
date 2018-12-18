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
let partyA, partyC, partyD

describe('updateBalances()', function () {
  beforeEach('init client and accounts', async () => {
    accounts = await web3.eth.getAccounts()
    ingridAddress = accounts[0]
    partyA = accounts[1]
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

  describe('mocked contract and hub', function () {
    let stubHub
    beforeEach('create stubbed hub methods', async () => {
      // activate nock
      if (!nock.isActive()) nock.activate()
      // stub contract methods
      client.channelManagerInstance.methods = createStubbedContract()

      // stub hub methods
      stubHub = await createStubbedHub(`${client.ingridUrl}`, 'OPEN_LC_OPEN_VC')
    })

    it('should create a channel and thread state update with ETH and TOKEN updates', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const threadBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const channelBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether'))
      }
      const channelBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        },
        {
          type: 'LEDGER',
          payment: {
            channelId: channelId,
            balanceA: channelBalanceA,
            balanceB: channelBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'PURCHASE',
            fields: {
              productSku: 6969,
              productName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyA)
      expect(results.length).to.equal(2)
    })

    it('should create a channel and thread state update with ETH only updates', async () => {
      const channelId =
        '0x3000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0200000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        tokenDeposit: null
      }
      const threadBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenDeposit: null
      }
      const channelBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether')),
        tokenDeposit: null
      }
      const channelBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        tokenDeposit: null
      }
      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        },
        {
          type: 'LEDGER',
          payment: {
            channelId: channelId,
            balanceA: channelBalanceA,
            balanceB: channelBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'PURCHASE',
            fields: {
              productSku: 6969,
              productName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyC)
      expect(results.length).to.equal(2)
    })

    it('should create a channel and thread state update with TOKEN only updates', async () => {
      const channelId =
        '0x4000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0300000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const threadBalanceB = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const channelBalanceA = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether'))
      }
      const channelBalanceB = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        },
        {
          type: 'LEDGER',
          payment: {
            channelId: channelId,
            balanceA: channelBalanceA,
            balanceB: channelBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'PURCHASE',
            fields: {
              productSku: 6969,
              productName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyD)
      expect(results.length).to.equal(2)
    })

    it('should create a channel state update with ETH and TOKEN updates', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const channelBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether'))
      }
      const channelBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const payments = [
        {
          type: 'LEDGER',
          payment: {
            channelId: channelId,
            balanceA: channelBalanceA,
            balanceB: channelBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'PURCHASE',
            fields: {
              productSku: 6969,
              productName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyA)
      expect(results.length).to.equal(1)
    })

    it('should create a channel state update with ETH only updates', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const channelBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether')),
        tokenDeposit: null
      }
      const channelBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        tokenDeposit: null
      }
      const payments = [
        {
          type: 'LEDGER',
          payment: {
            channelId: channelId,
            balanceA: channelBalanceA,
            balanceB: channelBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'PURCHASE',
            fields: {
              productSku: 6969,
              productName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyA)
      expect(results.length).to.equal(1)
    })

    it('should create a channel state update with TOKEN updates', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const channelBalanceA = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether'))
      }
      const channelBalanceB = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const payments = [
        {
          type: 'LEDGER',
          payment: {
            channelId: channelId,
            balanceA: channelBalanceA,
            balanceB: channelBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'PURCHASE',
            fields: {
              productSku: 6969,
              productName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyA)
      expect(results.length).to.equal(1)
    })

    it('should create a thread state update with ETH and TOKEN updates', async () => {
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const threadBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyA)
      expect(results.length).to.equal(1)
    })

    it('should create a thread state update with ETH only updates', async () => {
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        tokenDeposit: null
      }
      const threadBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenDeposit: null
      }
      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyA)
      expect(results.length).to.equal(1)
    })

    it('should create a channel state update with TOKEN updates', async () => {
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const threadBalanceB = {
        ethDeposit: null,
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        }
      ]

      const results = await client.updateBalances(payments, partyA)
      expect(results.length).to.equal(1)
    })

    afterEach('restore hub', () => {
      nock.restore()
      nock.cleanAll()
    })
  })

  describe('parameter validation', function () {
    it('should fail if invalid sender is provided', async () => {
      const channelId =
        '0x1000000000000000000000000000000000000000000000000000000000000000'
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const threadBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const channelBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('3', 'ether'))
      }
      const channelBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        },
        {
          type: 'LEDGER',
          payment: {
            channelId: channelId,
            balanceA: channelBalanceA,
            balanceB: channelBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'PURCHASE',
            fields: {
              productSku: 6969,
              productName: 'Agent Smith'
            }
          }
        }
      ]
      try {
        await client.updateBalances(payments, 'fail')
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if no payments object is provided', async () => {
      const payments = null
      try {
        await client.updateBalances(payments, partyA)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if payments object is not an array', async () => {
      const payments = ';)'
      try {
        await client.updateBalances(payments, partyA)
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should fail if objects in payments array has no type field', async () => {
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const threadBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payments = [
        {
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        }
      ]
      try {
        await client.updateBalances(payments, partyA)
      } catch (e) {
        expect(e.statusCode).to.equal(500)
      }
    })

    it('should fail if objects in payments array has null type field', async () => {
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const threadBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payments = [
        {
          type: null,
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        }
      ]
      try {
        await client.updateBalances(payments, partyA)
      } catch (e) {
        expect(e.statusCode).to.equal(500)
      }
    })

    it('should fail if objects in payments array has invalid type field', async () => {
      const threadId =
        '0x0100000000000000000000000000000000000000000000000000000000000000'
      const threadBalanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.9', 'ether'))
      }
      const threadBalanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const payments = [
        {
          type: 'fail',
          payment: {
            channelId: threadId,
            balanceA: threadBalanceA,
            balanceB: threadBalanceB
          },
          meta: {
            receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
            type: 'TIP',
            fields: {
              streamId: 6969,
              performerId: 1337,
              performerName: 'Agent Smith'
            }
          }
        }
      ]
      try {
        await client.updateBalances(payments, partyA)
      } catch (e) {
        expect(e.statusCode).to.equal(500)
      }
    })
  })
})
