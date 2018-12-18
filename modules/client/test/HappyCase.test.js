require('dotenv').config()
const chai = require('chai')
const expect = chai.expect
const Web3 = require('web3')
const fetch = require('fetch-cookie')(require('node-fetch'))
const interval = require('interval-promise')
const tokenAbi = require('human-standard-token-abi')

global.fetch = fetch

const Connext = require('../src/Connext')

// named variables
// on init
const web3 = new Web3(process.env.ETH_NODE_URL)
let client
let ingridAddress
let ingridUrl = process.env.HUB_URL
let contractAddress = process.env.CONTRACT_ADDRESS
let tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS
let watcherUrl = ''

const token = new web3.eth.Contract(tokenAbi, tokenAddress)

// for accounts
let accounts
let partyA, partyB, partyC, partyD, partyE, partyF

// for initial ledger channel states
let subchanAI, subchanBI, subchanCI, subchanDI, subchanEI
let chanA, chanB, chanC, chanD, chanE
let balanceA, balanceB
let threadIdA, threadIdC, threadIdD, threadIdE
let threadA, threadC, threadD, threadE

function genAuthHash (nonce, origin) {
  let msg = `SpankWallet authentication message: ${web3.utils.sha3(nonce)} ${web3.utils.sha3(origin)}`

  return web3.utils.sha3(msg)
}

describe.skip('Connext happy case ETH testing flow', () => {
  before('authenticate', async () => {
    accounts = await web3.eth.getAccounts()
    ingridAddress = accounts[0]
    partyA = accounts[1]
    partyB = accounts[2]
    partyC = accounts[3]
    partyD = accounts[4]
    partyE = accounts[5]

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

    expect(authJson).to.not.deep.equal({})

    // init client instance
    client = new Connext({
      web3,
      ingridAddress,
      watcherUrl,
      ingridUrl,
      contractAddress
    })

    // make sure auth works
    const challenge = await client.getChallengeTimer()
    expect(challenge).to.equal(3600)
  })

  describe('Registering with the hub', () => {
    describe('registering partyA with hub', () => {
      it
        (
          'should create a ledger channel with the hub and partyA and wait for chainsaw',
          async () => {
            const initialDeposit = {
              ethDeposit: Web3.utils.toBN(Web3.utils.toWei('6', 'ether'))
            }
            subchanAI = await client.openChannel(initialDeposit, null, partyA)
            // ensure lc is in the database
            await interval(async (iterationNumber, stop) => {
              chanA = await client.getChannelById(subchanAI)
              if (chanA != null) {
                stop()
              }
            }, 2000)
            expect(chanA.channelId).to.be.equal(subchanAI)
          }
        )
        .timeout(45000)

      it
        ('hub should have autojoined chanA', async () => {
          // ensure lc is in the database
          await interval(async (iterationNumber, stop) => {
            chanA = await client.getChannelById(subchanAI)
            if (chanA.state != 'LCS_OPENING') {
              stop()
            }
          }, 2000)
          expect(chanA.state).to.be.equal('LCS_OPENED')
        })
        .timeout(45000)

      it('hub should have 0 balance in chanA', async () => {
        const ethBalanceI = Web3.utils.toBN(chanA.ethBalanceI)
        expect(ethBalanceI.eq(Web3.utils.toBN('0'))).to.equal(true)
      })

      it('client should have initialDeposit in chanA', async () => {
        const initialDeposit = {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('6', 'ether'))
        }
        const ethBalanceA = Web3.utils.toBN(chanA.ethBalanceA)
        expect(ethBalanceA.eq(initialDeposit.ethDeposit)).to.equal(true)
      })

      it('should return the contract address', async () => {
        const addr = await client.getContractAddress(subchanAI)
        expect(addr).to.equal(contractAddress)
      })
    })

    describe('registering partyB with hub', () => {
      it('should create a ledger channel with the hub and partyB', async () => {
        const initialDeposit = {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
        }
        subchanBI = await client.openChannel(initialDeposit, null, partyB)
        // ensure lc is in the database
        await interval(async (iterationNumber, stop) => {
          chanB = await client.getChannelById(subchanBI)
          if (chanB != null) {
            stop()
          }
        }, 2000)
        expect(chanB.channelId).to.be.equal(subchanBI)
      }).timeout(45000)

      it('hub should have autojoined channel', async () => {
        await interval(async (iterationNumber, stop) => {
          chanB = await client.getChannelById(subchanBI)
          if (chanB.state != 'LCS_OPENING') {
            stop()
          }
        }, 2000)
        expect(chanB.state).to.be.equal('LCS_OPENED')
      }).timeout(45000)

      it('hub should have 0 balance in chanB', async () => {
        const ethBalanceI = Web3.utils.toBN(chanB.ethBalanceI)
        expect(ethBalanceI.eq(Web3.utils.toBN('0'))).to.equal(true)
      })

      it('client should have 0 balance in chanB', async () => {
        const ethBalanceA = Web3.utils.toBN(chanB.ethBalanceA)
        expect(
          ethBalanceA.eq(Web3.utils.toBN(Web3.utils.toWei('0', 'ether')))
        ).to.equal(true)
      })
    })

    describe('register partyC, partyD, and partyE with hub', () => {
      it(
        'should create a ledger channel with the hub and partyC, partyD, and partyE',
        async () => {
          const initialDeposit = {
            ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
          }
          subchanCI = await client.openChannel(initialDeposit, null, partyC)
          subchanDI = await client.openChannel(initialDeposit, null, partyD)
          subchanEI = await client.openChannel(initialDeposit, null, partyE)
          // ensure lc is in the database
          await interval(async (iterationNumber, stop) => {
            chanC = await client.getChannelById(subchanCI)
            if (chanC != null) {
              stop()
            }
          }, 2000)
          chanD = await client.getChannelById(subchanDI)
          chanE = await client.getChannelById(subchanEI)
          expect(chanC.channelId).to.be.equal(subchanCI)
          expect(chanD.channelId).to.be.equal(subchanDI)
          expect(chanE.channelId).to.be.equal(subchanEI)
        }
      ).timeout(45000)

      it('hub should have autojoined channels', async () => {
        await interval(async (iterationNumber, stop) => {
          chanC = await client.getChannelById(subchanCI)
          if (chanC.state != 'LCS_OPENING') {
            stop()
          }
        }, 2000)
        chanD = await client.getChannelById(subchanDI)
        chanE = await client.getChannelById(subchanEI)
        expect(chanC.state).to.be.equal('LCS_OPENED')
        expect(chanD.state).to.be.equal('LCS_OPENED')
        expect(chanE.state).to.be.equal('LCS_OPENED')
      }).timeout(45000)

      it('hub should have 0 balance in all channels', async () => {
        const ethBalanceCI = Web3.utils.toBN(chanC.ethBalanceI)
        expect(ethBalanceCI.eq(Web3.utils.toBN('0'))).to.equal(true)
        const ethBalanceDI = Web3.utils.toBN(chanD.ethBalanceI)
        expect(ethBalanceDI.eq(Web3.utils.toBN('0'))).to.equal(true)
        const ethBalanceEI = Web3.utils.toBN(chanE.ethBalanceI)
        expect(ethBalanceEI.eq(Web3.utils.toBN('0'))).to.equal(true)
      })
    })

    describe('registration error cases', async () => {
      it('should throw an error if you have open and active LC', async () => {
        const initialDeposit = {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('6', 'ether'))
        }
        try {
          await client.openChannel(initialDeposit, null, partyA)
        } catch (e) {
          expect(e.statusCode).to.equal(401)
          expect(e.name).to.equal('ChannelOpenError')
          expect(e.methodName).to.equal('openChannel')
        }
      })
    })
  })

  describe('Requesting hub deposit', () => {
    it(
      'request hub deposits into chanB for all viewer chan.ethBalanceA',
      async () => {
        chanA = await client.getChannelByPartyA(partyA)
        chanC = await client.getChannelByPartyA(partyC)
        chanD = await client.getChannelByPartyA(partyD)
        chanE = await client.getChannelByPartyA(partyE)

        const ethDeposit = Web3.utils
          .toBN(chanA.ethBalanceA)
          // .toBN(Web3.utils.toWei('6', 'ether'))
          .add(Web3.utils.toBN(chanC.ethBalanceA))
          .add(Web3.utils.toBN(chanD.ethBalanceA))
          .add(Web3.utils.toBN(chanE.ethBalanceA))
          .mul(Web3.utils.toBN(3))
        // multiple to avoid autoDeposit on vc creation
        const response = await client.requestHubDeposit({
          channelId: subchanBI,
          deposit: {
            ethDeposit
          }
        })
        await interval(async (iterationNumber, stop) => {
          chanB = await client.getChannelById(subchanBI)
          if (
            chanB != null && // exists
            chanB.state === 'LCS_OPENED' && // joined
            !Web3.utils.toBN(chanB.ethBalanceI).isZero()
          ) {
            stop()
          }
        }, 2000)
        expect(ethDeposit.eq(Web3.utils.toBN(chanB.ethBalanceI))).to.equal(true)
      }
    ).timeout(60000)

    it('should throw an error if hub has insufficient funds', async () => {
      const balance = await client.web3.eth.getBalance(ingridAddress)
      const ethDeposit = Web3.utils
        .toBN(balance)
        .add(Web3.utils.toBN(Web3.utils.toWei('1000', 'ether')))
      try {
        await client.requestHubDeposit({
          channelId: subchanBI,
          deposit: {
            ethDeposit
          }
        })
      } catch (e) {
        expect(e.statusCode).to.equal(500)
      }
    })
  })

  describe('Creating a virtual channel', () => {
    describe('openThread between partyA and partyB', () => {
      it('should create a new virtual channel between partyA and partyB', async () => {
        const initialDeposit = {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
        }
        chanA = await client.getChannelById(subchanAI)
        threadIdA = await client.openThread({
          to: partyB,
          sender: partyA,
          deposit: initialDeposit
        })
        threadA = await client.getThreadById(threadIdA)
        expect(threadA.channelId).to.equal(threadIdA)
      })

      it('balanceA in chanA should be 1', async () => {
        chanA = await client.getChannelById(subchanAI)
        expect(
          Web3.utils
            .toBN(Web3.utils.toWei('1', 'ether'))
            .eq(Web3.utils.toBN(chanA.ethBalanceA))
        ).to.equal(true)
      })

      it('hub should countersign proposed LC update', async () => {
        let state = await client.getLatestChannelState(subchanAI)
        // recover signer from sigI
        const signer = Connext.recoverSignerFromChannelStateUpdate({
          sig: state.sigI,
          isClose: false,
          channelId: subchanAI,
          nonce: state.nonce,
          openVcs: state.openVcs,
          vcRootHash: state.vcRootHash,
          partyA: partyA,
          partyI: ingridAddress,
          ethBalanceA: Web3.utils.toBN(state.ethBalanceA),
          ethBalanceI: Web3.utils.toBN(state.ethBalanceI),
          tokenBalanceA: Web3.utils.toBN(state.tokenBalanceA),
          tokenBalanceI: Web3.utils.toBN(state.tokenBalanceI)
        })
        expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
      })

      it('hub should create update for chanB', async () => {
        threadA = await client.getThreadById(threadIdA)
        let state = await client.getLatestChannelState(subchanBI, ['sigI'])
        const signer = Connext.recoverSignerFromChannelStateUpdate({
          sig: state.sigI,
          isClose: false,
          channelId: subchanBI,
          nonce: state.nonce,
          openVcs: state.openVcs,
          vcRootHash: state.vcRootHash,
          partyA: partyB,
          partyI: ingridAddress,
          ethBalanceA: Web3.utils.toBN(state.ethBalanceA),
          ethBalanceI: Web3.utils.toBN(state.ethBalanceI),
          tokenBalanceA: Web3.utils.toBN(state.tokenBalanceA),
          tokenBalanceI: Web3.utils.toBN(state.tokenBalanceI)
        })
        expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
      })
    })

    describe('partyB should be able to recieve multiple openThread updates', () => {
      it('should create a new virtual channel between partyC and partyB', async () => {
        threadIdC = await client.openThread({ to: partyB, sender: partyC })
        threadC = await client.getThreadById(threadIdC)
        expect(threadC.channelId).to.equal(threadIdC)
      })

      it('should create a new virtual channel between partyD and partyB', async () => {
        threadIdD = await client.openThread({ to: partyB, sender: partyD })
        threadD = await client.getThreadById(threadIdD)
        expect(threadD.channelId).to.equal(threadIdD)
      })
    })
  })

  describe('Updating balances in a channel', async () => {

    it('should call updateBalances in threadA', async () => {
      const balanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4', 'ether'))
      }
      const balanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      const response = await client.updateBalances(
        [
          {
            type: 'VIRTUAL',
            payment: {
              channelId: threadIdA,
              balanceA,
              balanceB
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
        ],
        partyA
      )
      threadA = await client.getThreadById(threadIdA)
      expect(
        Web3.utils.toBN(threadA.ethBalanceA).eq(balanceA.ethDeposit)
      ).to.equal(true)
      expect(
        Web3.utils.toBN(threadA.ethBalanceB).eq(balanceB.ethDeposit)
      ).to.equal(true)
    })

    it('partyA should properly sign the proposed update', async () => {
      const state = await client.getLatestThreadState(threadIdA)
      const signer = Connext.recoverSignerFromThreadStateUpdate({
        sig: state.sigA,
        channelId: threadIdA,
        nonce: state.nonce,
        partyA: partyA,
        partyB: partyB,
        ethBalanceA: Web3.utils.toBN(state.ethBalanceA),
        ethBalanceB: Web3.utils.toBN(state.ethBalanceB),
        tokenBalanceA: Web3.utils.toBN(state.tokenBalanceA),
        tokenBalanceB: Web3.utils.toBN(state.tokenBalanceB)
      })
      expect(signer.toLowerCase()).to.equal(partyA.toLowerCase())
    })

    it('partyA should be able to send multiple state updates in a row', async () => {
      threadA = await client.getThreadById(threadIdA)
      console.log('threadA:', threadA)
      let balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB)
      }
      for (let i = 0; i < 10; i++) {
        balanceA.ethDeposit = balanceA.ethDeposit.sub(balDiff)
        balanceB.ethDeposit = balanceB.ethDeposit.add(balDiff)

        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                balanceA,
                balanceB,
                channelId: threadIdA
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
          ],
          partyA
        )
      }
      threadA = await client.getThreadById(threadIdA)
      expect(
        balanceA.ethDeposit.eq(Web3.utils.toBN(threadA.ethBalanceA))
      ).to.equal(true)
      expect(
        balanceB.ethDeposit.eq(Web3.utils.toBN(threadA.ethBalanceB))
      ).to.equal(true)
    }).timeout(7000)

    it('should be able to send ledger and virtual channel updates simultaneously', async () => {
      threadA = await client.getThreadById(threadIdA)
      chanA = await client.getChannelById(subchanAI)
      chanB = await client.getChannelById(subchanBI)
      expect(chanB.state).to.equal('LCS_OPENED')
      expect(chanA.state).to.equal('LCS_OPENED')
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      const vcA1 = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).sub(balDiff)
      }

      const lcA1 = {
        ethDeposit: Web3.utils.toBN(chanA.ethBalanceA).sub(balDiff)
      }

      const vcB1 = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      const lcI1 = {
        ethDeposit: Web3.utils.toBN(chanA.ethBalanceI).add(balDiff)
      }

      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadIdA,
            balanceA: vcA1,
            balanceB: vcB1
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
            channelId: subchanAI,
            balanceA: lcA1,
            balanceB: lcI1
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

      const responses = await client.updateBalances(payments, partyA)
      expect(responses).to.have.lengthOf(2)
      for (const r of responses) {
        expect(r.id).to.exist
      }
      // verify new balances
      threadA = await client.getThreadById(threadIdA)
      chanA = await client.getChannelById(subchanAI)
      // vc
      expect(threadA.nonce).to.equal(responses[0].nonce)
      expect(threadA.ethBalanceA).to.equal(responses[0].ethBalanceA)
      expect(threadA.ethBalanceB).to.equal(responses[0].ethBalanceB)
      // lc
      expect(chanA.nonce).to.equal(responses[1].nonce)
      expect(chanA.ethBalanceA).to.equal(responses[1].ethBalanceA)
      expect(chanA.ethBalanceI).to.equal(responses[1].ethBalanceI)
    })

    it('should not prohibit the creation of a virtual channel', async () => {
      threadIdE = await client.openThread({ to: partyB, sender: partyE })
      threadE = await client.getThreadById(threadIdE)
      expect(threadE.channelId).to.equal(threadIdE)
    })

    it('partyB should be able to recieve state updates across multiple vcs', async () => {
      threadC = await client.getThreadByParties({ partyA: partyC, partyB })
      threadD = await client.getThreadByParties({ partyA: partyD, partyB })
      console.log('should be able to handle 4:1 state update in both')
      console.log('threadC:', threadC)
      console.log('threadD:', threadD)
      balanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4', 'ether'))
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      await client.updateBalances(
        [
          {
            type: 'VIRTUAL',
            payment: {
              channelId: threadC.channelId,
              balanceA,
              balanceB
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
        ],
        partyC
      )
      await client.updateBalances(
        [
          {
            type: 'VIRTUAL',
            payment: {
              channelId: threadD.channelId,
              balanceA,
              balanceB
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
        ],
        partyD
      )
      // multiple balance updates
      for (let i = 0; i < 10; i++) {
        balanceA.ethDeposit = balanceA.ethDeposit.sub(
          Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        )
        balanceB.ethDeposit = balanceB.ethDeposit.add(
          Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
        )
        const sender = i % 2 === 0 ? partyC : partyD
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: i % 2 === 0 ? threadC.channelId : threadD.channelId,
                balanceA,
                balanceB
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
          ],
          sender
        )
      }
      threadD = await client.getThreadById(threadD.channelId)
      expect(
        Web3.utils.toBN(threadD.ethBalanceA).eq(balanceA.ethDeposit)
      ).to.equal(true)
      expect(
        Web3.utils.toBN(threadD.ethBalanceB).eq(balanceB.ethDeposit)
      ).to.equal(true)
    }).timeout(8000)

    it('should throw an error if the balanceB decreases', async () => {
      balanceA = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('4', 'ether'))
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
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
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(550)
      }
    })

    it('should throw an error if no purchaseMeta receiver is included', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'TIP',
                fields: {
                  streamId: 6969,
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if an improper purchaseMeta receiver is provided', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                receiver: 'nope',
                type: 'TIP',
                fields: {
                  streamId: 6969,
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if no purchaseMeta type is provided', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                fields: {
                  streamId: 6969,
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if an improper purchaseMeta type is provided', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'fail',
                fields: {
                  streamId: 6969,
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if TIP purchaseMETA is missing the fields object', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'TIP'
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if TIP purchaseMETA is missing a fields.streamId', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'fail',
                fields: {
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if TIP purchaseMETA is missing the fields.performerId', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'fail',
                fields: {
                  streamId: 6969,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if TIP purchaseMETA is missing the fields.performerName', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'fail',
                fields: {
                  streamId: 6969,
                  performerId: 1337
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if a PURCHASE purchaseMeta has no fields', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
                type: 'PURCHASE'
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if a PURCHASE purchaseMeta has no fields.productSku', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
                type: 'PURCHASE',
                fields: {
                  productSku: 6969
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if a PURCHASE purchaseMeta has no fields.productName', async () => {
      const balDiff = Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      balanceA = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceA).add(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils.toBN(threadA.ethBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
                type: 'PURCHASE',
                fields: {
                  productSku: 6969
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })

  describe('Testing the potentially liquidate fn', () => {
    it('should print the right stuff', async () => {
      threadA = await client.getThreadById(threadA.channelId)
      chanA = await client.getChannelById(subchanAI)
      console.log('address:', partyA.toLowerCase())
      const response = await client.potentiallyLiquidate(threadA.channelId, partyA)
      console.log('potentiallyLiquidate response:', response)
      expect(Web3.utils.toBN('0').eq(Web3.utils.toBN(response.vcBooty))).to.equal(true)
      expect(Web3.utils.toBN('0').eq(Web3.utils.toBN(response.lcBooty))).to.equal(true)
    })
  })

  describe('Closing a virtual channel', () => {
    it('should change threadA status to settled', async () => {
      threadA = await client.getThreadByParties({ partyA, partyB })
      const response = await client.closeThread(threadA.channelId, partyA)
      // get threadA
      threadA = await client.getThreadById(threadA.channelId)
      expect(threadA.state).to.equal('VCS_SETTLED')
    })

    it('should increase chanA balanceA by threadA.balanceA remainder', async () => {
      // get objs
      chanA = await client.getChannelByPartyA(partyA)
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: chanA.channelId,
        nonce: chanA.nonce - 1
      })
      const expectedBalA = Web3.utils
        .toBN(prevState.ethBalanceA)
        .add(Web3.utils.toBN(threadA.ethBalanceA))
      expect(expectedBalA.eq(Web3.utils.toBN(chanA.ethBalanceA))).to.equal(true)
    })

    it('should increase chanA balanceI by threadA.balanceB', async () => {
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: chanA.channelId,
        nonce: chanA.nonce - 1
      })
      const expectedBalI = Web3.utils
        .toBN(prevState.ethBalanceI)
        .add(Web3.utils.toBN(threadA.ethBalanceB))
      expect(expectedBalI.eq(Web3.utils.toBN(chanA.ethBalanceI))).to.equal(true)
    })

    it('should increase chanB balanceA by threadA.balanceB', async () => {
      // get objs
      chanB = await client.getChannelByPartyA(partyB)
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: subchanBI,
        nonce: chanB.nonce - 1
      })
      const expectedBalA = Web3.utils
        .toBN(prevState.ethBalanceA)
        .add(Web3.utils.toBN(threadA.ethBalanceB))
      expect(expectedBalA.eq(Web3.utils.toBN(chanB.ethBalanceA))).to.equal(true)
    })

    it('should decrease chanB balanceI by threadA.balanceA', async () => {
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: subchanBI,
        nonce: chanB.nonce - 1
      })
      const expectedBalI = Web3.utils
        .toBN(prevState.ethBalanceI)
        .add(Web3.utils.toBN(threadA.ethBalanceA))
      expect(expectedBalI.eq(Web3.utils.toBN(chanB.ethBalanceI))).to.equal(true)
    })

    it('should not interrupt the flow of other vcs', async () => {
      threadC = await client.getThreadByParties({ partyA: partyC, partyB })
      balanceA = {
        ethDeposit: Web3.utils
          .toBN(threadC.ethBalanceA)
          .sub(Web3.utils.toBN(Web3.utils.toWei('1', 'ether')))
      }
      balanceB = {
        ethDeposit: Web3.utils
          .toBN(threadC.ethBalanceB)
          .add(Web3.utils.toBN(Web3.utils.toWei('1', 'ether')))
      }

      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadC.channelId,
            balanceA,
            balanceB
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
      await client.updateBalances(payments, partyC)
      threadC = await client.getThreadById(threadC.channelId)
      expect(
        balanceA.ethDeposit.eq(Web3.utils.toBN(threadC.ethBalanceA))
      ).to.equal(true)
    })

    it('partyB should be able to close a channel', async () => {
      threadC = await client.getThreadByParties({ partyA: partyC, partyB })
      const response = await client.closeThread(threadC.channelId, partyB)
      // get vc
      threadC = await client.getThreadById(threadC.channelId)
      expect(threadC.state).to.equal('VCS_SETTLED')
    })

    // ensure math stays the same
    it('should increase chanC balanceA by threadC.balanceA remainder', async () => {
      // get objs
      chanC = await client.getChannelByPartyA(partyC)
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: chanC.channelId,
        nonce: chanC.nonce - 1
      })
      const expectedBalA = Web3.utils
        .toBN(prevState.ethBalanceA)
        .add(Web3.utils.toBN(threadC.ethBalanceA))
      expect(expectedBalA.eq(Web3.utils.toBN(chanC.ethBalanceA))).to.equal(true)
    })

    it('should increase chanC balanceI by threadC.balanceB', async () => {
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: chanC.channelId,
        nonce: chanC.nonce - 1
      })
      const expectedBalI = Web3.utils
        .toBN(prevState.ethBalanceI)
        .add(Web3.utils.toBN(threadC.ethBalanceB))
      expect(expectedBalI.eq(Web3.utils.toBN(chanC.ethBalanceI))).to.equal(true)
    })

    it('should increase chanB balanceA by threadC.balanceB', async () => {
      // get objs
      chanB = await client.getChannelByPartyA(partyB)
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: subchanBI,
        nonce: chanB.nonce - 1
      })
      const expectedBalA = Web3.utils
        .toBN(prevState.ethBalanceA)
        .add(Web3.utils.toBN(threadC.ethBalanceB))
      expect(expectedBalA.eq(Web3.utils.toBN(chanB.ethBalanceA))).to.equal(true)
    })

    it('should decrease chanB balanceI by threadA.balanceA', async () => {
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: subchanBI,
        nonce: chanB.nonce - 1
      })
      const expectedBalI = Web3.utils
        .toBN(prevState.ethBalanceI)
        .add(Web3.utils.toBN(threadC.ethBalanceA))
      expect(expectedBalI.eq(Web3.utils.toBN(chanB.ethBalanceI))).to.equal(true)
    })

    it('partyB should be able to close multiple channels', async () => {
      threadD = await client.getThreadByParties({ partyA: partyD, partyB })
      threadE = await client.getThreadByParties({ partyA: partyE, partyB })
      const channelIds = [threadD.channelId, threadE.channelId]
      const results = await client.closeThreads(channelIds, partyB)

      // refetch channels
      threadD = await client.getThreadById(threadD.channelId)
      threadE = await client.getThreadById(threadE.channelId)

      expect(threadD.state).to.equal('VCS_SETTLED')
      expect(threadE.state).to.equal('VCS_SETTLED')
    })
  })

  describe('Closing a ledger channel', () => {
    let prevBalA, finalBalA, prevBalI, finalBalI

    before('Create a virtual channel that has not been closed', async () => {
      threadIdC = await client.openThread({ to: partyB, sender: partyC })
      threadC = await client.getThreadById(threadIdC)
    })

    it(`should close partyA's LC with the fast close flag`, async () => {
      prevBalA = await client.web3.eth.getBalance(partyA)
      prevBalI = await client.web3.eth.getBalance(ingridAddress)
      // send tx
      const response = await client.closeChannel(partyA)
      console.log('response:', response)
      const tx = await client.web3.eth.getTransaction(response)
      console.log('tx:', tx)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyA.toLowerCase())
    }).timeout(10000)

    it(`should transfer balanceA of partyA's lc into wallet`, async () => {
      chanA = await client.getChannelByPartyA(partyA)
      const expected = Web3.utils.fromWei(
        Web3.utils.toBN(chanA.ethBalanceA).add(Web3.utils.toBN(prevBalA)),
        'ether'
      )
      finalBalA = Web3.utils.fromWei(
        await client.web3.eth.getBalance(partyA),
        'ether'
      )
      expect(Math.round(expected)).to.equal(Math.round(finalBalA))
    }).timeout(10000)

    it(`should transfer balanceI of lc into hubs wallet`, async () => {
      const expected = Web3.utils.fromWei(
        Web3.utils.toBN(chanA.ethBalanceI).add(Web3.utils.toBN(prevBalI)),
        'ether'
      )
      finalBalI = Web3.utils.fromWei(
        await client.web3.eth.getBalance(ingridAddress),
        'ether'
      )
      expect(Math.round(expected)).to.equal(Math.round(finalBalI))
    })

    it(`should not let you close an LC with openVCs`, async () => {
      try {
        const response = await client.closeChannel(partyB) // + 7 ETH
      } catch (e) {
        expect(e.statusCode).to.equal(600)
      }
    }).timeout(9000)

    it('should not interrupt the flow of open VCs', async () => {
      threadC = await client.getThreadByParties({ partyA: partyC, partyB })
      balanceA = {
        ethDeposit: Web3.utils
          .toBN(threadC.ethBalanceA)
          .sub(Web3.utils.toBN(Web3.utils.toWei('1', 'ether')))
      }
      balanceB = {
        ethDeposit: Web3.utils
          .toBN(threadC.ethBalanceB)
          .add(Web3.utils.toBN(Web3.utils.toWei('1', 'ether')))
      }
      await client.updateBalances(
        [
          {
            type: 'VIRTUAL',
            payment: {
              channelId: threadC.channelId,
              balanceA,
              balanceB
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
        ],
        partyC
      )
      threadC = await client.getThreadById(threadC.channelId)
      expect(
        balanceA.ethDeposit.eq(Web3.utils.toBN(threadC.ethBalanceA))
      ).to.equal(true)
    })

    it(`should close partyC's LC with the fast close`, async () => {
      // close open vcs
      await client.closeThread(threadC.channelId, partyC)
      // send tx
      const response = await client.closeChannel(partyC)
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyC.toLowerCase())
    }).timeout(8000)

    it(`should close partyD's LC with the fast close`, async () => {
      // send tx
      const response = await client.closeChannel(partyD)
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyD.toLowerCase())
    }).timeout(8000)

    it(`should close partyE's LC with the fast close`, async () => {
      // send tx
      const response = await client.closeChannel(partyE)
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyE.toLowerCase())
    }).timeout(8000)

    it(`should close partyB's LC with the fast close`, async () => {
      prevBalA = await client.web3.eth.getBalance(partyB) // 95 ETH
      const response = await client.closeChannel(partyB) // + 7 ETH
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyB.toLowerCase())
    }).timeout(15000)

    it(`should transfer balanceA partyB's into wallet`, async () => {
      chanB = await client.getChannelByPartyA(partyB)
      const expected = Web3.utils.fromWei(
        Web3.utils.toBN(chanB.ethBalanceA).add(Web3.utils.toBN(prevBalA)),
        'ether'
      )
      finalBal = Web3.utils.fromWei(
        await client.web3.eth.getBalance(partyB),
        'ether'
      )
      expect(Math.round(expected)).to.equal(Math.round(finalBal))
    })
  })

  describe.skip('Opening threads while hub is autodepositing', () => {
    it('should wait for chainsaw...', async () => {
      chanB = await client.getChannelByPartyA(partyB)
      // ensure lc is in the database
      await interval(async (iterationNumber, stop) => {
        chanB = await client.getChannelByPartyA(partyB)
        if (chanB.state !== 'LCS_OPENED') {
          stop()
        }
      }, 2000)
      expect(chanB.state).to.be.equal('LCS_CLOSED')
    }).timeout(45000)

    it(
      'should create a ledger channel with the hub and partyA and partyB',
      async () => {
        let initialDeposit = {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('5', 'ether'))
        }
        subchanAI = await client.openChannel(initialDeposit, null, partyA)
        subchanCI = await client.openChannel(initialDeposit, null, partyC)
        initialDeposit.ethDeposit = Web3.utils.toBN('0', 'ether')
        subchanBI = await client.openChannel(initialDeposit, null, partyB)
        // ensure lc is in the database
        await interval(async (iterationNumber, stop) => {
          chanB = await client.getChannelById(subchanBI)
          if (chanB != null) {
            stop()
          }
        }, 2000)
        chanA = await client.getChannelById(subchanAI)
        chanC = await client.getChannelById(subchanCI)
        expect(chanA.channelId).to.be.equal(subchanAI)
        expect(chanB.channelId).to.be.equal(subchanBI)
        expect(chanC.channelId).to.be.equal(subchanCI)
      }
    ).timeout(45000)

    it('hub should have autojoined channels', async () => {
      await interval(async (iterationNumber, stop) => {
        chanB = await client.getChannelById(subchanBI)
        if (chanB.state != 'LCS_OPENING') {
          stop()
        }
      }, 2000)
      chanA = await client.getChannelById(subchanAI)
      chanC = await client.getChannelById(subchanCI)

      console.log('****** Status after autojoining *******')
      console.log(`chanA: ${JSON.stringify(chanA)}`)
      console.log(`chanB: ${JSON.stringify(chanB)}`)

      expect(chanA.state).to.be.equal('LCS_OPENED')
      expect(chanB.state).to.be.equal('LCS_OPENED')
      expect(chanC.state).to.be.equal('LCS_OPENED')
    }).timeout(45000)

    it('hub should have 0 balance in all channels', async () => {
      const ethBalanceAI = Web3.utils.toBN(chanA.ethBalanceI)
      expect(ethBalanceAI.eq(Web3.utils.toBN('0'))).to.equal(true)
      const ethBalanceBI = Web3.utils.toBN(chanB.ethBalanceI)
      expect(ethBalanceBI.eq(Web3.utils.toBN('0'))).to.equal(true)
      const ethBalanceCI = Web3.utils.toBN(chanC.ethBalanceI)
      expect(ethBalanceCI.eq(Web3.utils.toBN('0'))).to.equal(true)
    })

    it(
      'should request that hub deposits autodeposit (40 fin) min into chanB',
      async () => {
        const ethDeposit = Web3.utils.toBN(Web3.utils.toWei('.04', 'ether'))
        const response = await client.requestHubDeposit({
          channelId: subchanBI,
          deposit: {
            ethDeposit
          }
        })
        await interval(async (iterationNumber, stop) => {
          chanB = await client.getChannelById(subchanBI)
          if (
            chanB != null && // exists
            chanB.state === 'LCS_OPENED' && // joined
            !Web3.utils.toBN(chanB.ethBalanceI).isZero()
          ) {
            stop()
          }
        }, 2000)
        expect(ethDeposit.eq(Web3.utils.toBN(chanB.ethBalanceI))).to.equal(true)
      }
    ).timeout(45000)

    it('should open a thread with less then min deposit', async () => {
      const initialDeposit = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.02', 'ether'))
      }
      chanA = await client.getChannelById(subchanAI)
      threadIdA = await client.openThread({
        to: partyB,
        sender: partyA,
        deposit: initialDeposit
      })
      threadA = await client.getThreadById(threadIdA)
      expect(threadA.channelId).to.equal(threadIdA)
    })

    it('should be able to open another thread with more than min deposit simultaneously', async () => {
      const initialDeposit = {
        ethDeposit: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      chanA = await client.getChannelById(subchanAI)
      threadIdC = await client.openThread({
        to: partyB,
        sender: partyC,
        deposit: initialDeposit
      })
      threadC = await client.getThreadById(threadIdC)
      expect(threadC.channelId).to.equal(threadIdC)
    })

    it('should be able to close both threads', async () => {
      threadA = await client.getThreadByParties({ partyA, partyB })
      let response = await client.closeThread(threadA.channelId, partyA)
      // get threadA
      threadA = await client.getThreadById(threadA.channelId)
      expect(threadA.state).to.equal('VCS_SETTLED')
      threadC = await client.getThreadByParties({ partyA, partyB })
      response = await client.closeThread(threadC.channelId, partyA)
      // get threadC
      threadC = await client.getThreadById(threadC.channelId)
      expect(threadC.state).to.equal('VCS_SETTLED')
    })

    it('should close both ledger channels', async () => {
        // send tx
        let response = await client.closeChannel(partyC)
        let tx = await client.web3.eth.getTransaction(response)
        expect(tx.to.toLowerCase()).to.equal(contractAddress)
        expect(tx.from.toLowerCase()).to.equal(partyC.toLowerCase())
        response = await client.closeChannel(partyA)
        tx = await client.web3.eth.getTransaction(response)
        expect(tx.to.toLowerCase()).to.equal(contractAddress)
        expect(tx.from.toLowerCase()).to.equal(partyA.toLowerCase())
    }).timeout(45000)
  })
})

describe.only('ETH/ERC20 exchanging in channels', () => {
  before('authenticate', async () => {
    accounts = await web3.eth.getAccounts()
    ingridAddress = accounts[0]
    partyA = accounts[1]
    partyB = accounts[2] // token channel

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

    expect(authJson).to.not.deep.equal({})

    // init client instance
    client = new Connext({
      web3,
      ingridAddress,
      watcherUrl,
      ingridUrl,
      contractAddress
    })

    // make sure auth works
    const challenge = await client.getChallengeTimer()
    expect(challenge).to.equal(3600)
  })

  describe('register partyA and partyB with hub', () => {
    let maxBalance
        
    it('should set the maxBalance to be deposited in channels', async () => {
      const hubToken = await token.methods.balanceOf(ingridAddress).call()
      const partyAToken = await token.methods.balanceOf(partyA).call()
      maxBalance = Web3.utils.toBN(hubToken).lt(Web3.utils.toBN(partyAToken)) 
        ? Web3.utils.toBN(hubToken) 
        : Web3.utils.toBN(partyAToken)
      maxBalance = maxBalance.div(Web3.utils.toBN('10'))
      console.log('maxBalance set to:', maxBalance.toString())
    }).timeout(45000)

    it(
      'should create a channel with partyA and partyB',
      async () => {
        const initialDepositsA = {
          ethDeposit: maxBalance,
          tokenDeposit: Web3.utils.toBN('1')
        }
        // approve contract token transfer
        const { transactionHash } = await token.methods
          .approve(contractAddress, initialDepositsA.tokenDeposit)
          .send({ from: partyA})
        expect(transactionHash).to.exist
        
        // chanA goes eth --> erc
        // small token balance to allow tokens + ETH in channel
        subchanAI = await client.openChannel(
          initialDepositsA, 
          tokenAddress, 
          partyA)
        
        const initialDepositsB = {
          tokenDeposit: maxBalance
        }
        // approve contract token transfer    
        const { status } = await token.methods
          .approve(contractAddress, initialDepositsB.tokenDeposit)
          .send({ from: partyB})
        expect(status).to.equal(true)
        // chanB goes erc --> eth
        subchanBI = await client.openChannel(
          initialDepositsB, 
          tokenAddress, 
          partyB)

        // ensure lc is in the database
        await interval(async (iterationNumber, stop) => {
          chanB = await client.getChannelById(subchanBI)
          if (chanB != null) {
            stop()
          }
        }, 2000)
        chanA = await client.getChannelById(subchanAI)
        expect(Web3.utils.toBN(chanA.ethBalanceA).eq(maxBalance)).to.equal(true)
        expect(chanA.channelId).to.be.equal(subchanAI)
        expect(chanB.channelId).to.be.equal(subchanBI)
      }
    ).timeout(105000)

    it('hub should have autojoined channels', async () => {
      await interval(async (iterationNumber, stop) => {
        chanB = await client.getChannelById(subchanBI)
        if (chanB.state != 'LCS_OPENING') {
          stop()
        }
      }, 2000)
      chanA = await client.getChannelById(subchanAI)
      expect(chanA.state).to.be.equal('LCS_OPENED')
      expect(chanB.state).to.be.equal('LCS_OPENED')
    }).timeout(75000)

    it('hub should have 0 balance in all channels', async () => {
      const ethBalanceAI = Web3.utils.toBN(chanA.ethBalanceI)
      expect(ethBalanceAI.eq(Web3.utils.toBN('0'))).to.equal(true)
      const ethBalanceBI = Web3.utils.toBN(chanB.ethBalanceI)
      expect(ethBalanceBI.eq(Web3.utils.toBN('0'))).to.equal(true)
    })
  })

  describe('test untracked deposits', () => {
    subchanAI = subchanAI 
      ? subchanAI 
      : '0x36d85e0225e7867b0001b87171947b957efe0c56868a07ea93712e7fb694e8e1'
    const ethDeposit = Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
    const tokenDeposit = Web3.utils.toBN('1')
    
    let expectedEthBalance, expectedTokenBalance, expectedNonce
    let initialEthBalance, initialTokenBalance
    before('set expected values after deposit', async () => {
      chanA = await client.getChannelById(subchanAI)
      chanB = await client.getChannelById(subchanBI)
      console.log('Values before any deposits:')
      console.log('ethBalanceA:', chanA.ethBalanceA)
      console.log('tokenBalanceA:', chanA.tokenBalanceA)
      console.log('nonce:', chanA.nonce)
      initialEthBalance = Web3.utils.toBN(chanA.ethBalanceA)
      initialTokenBalance = Web3.utils.toBN(chanA.tokenBalanceA)

      expectedEthBalance = Web3.utils.toBN(chanA.ethBalanceA).add(ethDeposit)
      expectedTokenBalance = Web3.utils.toBN(chanA.tokenBalanceA).add(tokenDeposit)
      expectedNonce = chanA.nonce + 1
      console.log('\nAnticipated values:')
      console.log('ethBalanceA:', expectedEthBalance.toString())
      console.log('tokenBalanceA:', expectedTokenBalance.toString())
      console.log('nonce:', expectedNonce)
    })

    it('should deposit ETH on the channelManagerInstance without posting to hub', async () => {
      const { transactionHash, status } = await client
        .channelManagerInstance
        .methods
        .deposit(
          subchanAI,
          partyA,
          ethDeposit,
          false
        )
        .send({ from: partyA, value: ethDeposit, gas: 750000 })
      expect(status).to.equal(true)
      expect(transactionHash).to.exist
    }).timeout(45000)

    let untrackedDeposits
    it('should get the untracked ETH deposits from hub', async () => {
      await interval(async (iterationNumber, stop) => {
        untrackedDeposits = await client.getUntrackedDeposits(subchanAI, partyA)
        if (untrackedDeposits !== [] && untrackedDeposits.length == 1) {
          stop()
        }
      }, 2000)
      expect(Web3.utils.toBN(untrackedDeposits[0].deposit).eq(ethDeposit)).to.equal(true)
      expect(untrackedDeposits[0].recipient).to.equal(partyA.toLowerCase())
      console.log(`\nChannel values after chainsaw:`)
      chanA = await client.getChannelById(subchanAI)
      console.log(`ethBalanceA: ${chanA.ethBalanceA}`)
      console.log(`tokenBalanceA: ${chanA.tokenBalanceA}`)
      console.log(`nonce: ${chanA.nonce}`)
    }).timeout(45000)

    let response
    it('should post signed updates to hub', async () => {
      console.log(`\nFound ${untrackedDeposits.length} untracked deposits`)
      response = await client.signUntrackedDeposits({
        channelId: subchanAI, 
        untrackedDeposits,
        sender: partyA
      })
      // recover signer
      chanA = await client.getChannelById(subchanAI)
      
      console.log('\nValues after deposits:')
      console.log('ethBalanceA:', chanA.ethBalanceA)
      console.log('tokenBalanceA:', chanA.tokenBalanceA)
      console.log('nonce:', chanA.nonce)

      console.log('\nsignUntrackedDeposits Response')
      console.log(response)

      expect(expectedEthBalance.eq(Web3.utils.toBN(chanA.ethBalanceA))).to.equal(true)
      expect(chanA.nonce).to.equal(expectedNonce)
    })

    it('partyA and hub should sign the untracked ETH deposit as a state update', async () => {
      // generate expected hash
      chanA = await client.getChannelById(subchanAI)
      const ethBalanceA = Web3.utils.toBN(chanA.ethBalanceA)
      const tokenBalanceA = Web3.utils.toBN(chanA.tokenBalanceA)
      let signer = Connext.recoverSignerFromChannelStateUpdate({
        sig: response[0].sigA,
        channelId: subchanAI,
        isClose: false,
        nonce: chanA.nonce,
        openVcs: chanA.openVcs,
        vcRootHash: chanA.vcRootHash,
        partyA,
        partyI: ingridAddress,
        ethBalanceA,
        ethBalanceI: Web3.utils.toBN(chanA.ethBalanceI),
        tokenBalanceA: tokenBalanceA,
        tokenBalanceI: Web3.utils.toBN(chanA.tokenBalanceI),
      })
      expect(signer.toLowerCase()).to.equal(partyA.toLowerCase())

      signer = Connext.recoverSignerFromChannelStateUpdate({
        sig: response[0].sigI,
        channelId: subchanAI,
        isClose: false,
        nonce: chanA.nonce,
        openVcs: chanA.openVcs,
        vcRootHash: chanA.vcRootHash,
        partyA,
        partyI: ingridAddress,
        ethBalanceA,
        ethBalanceI: Web3.utils.toBN(chanA.ethBalanceI),
        tokenBalanceA: tokenBalanceA,
        tokenBalanceI: Web3.utils.toBN(chanA.tokenBalanceI),
      })
      expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
    })

    it('should deposit tokens on the channelManagerInstance without posting to hub', async () => {
      // approve contract token transfer
      const { transactionHash } = await token.methods
        .approve(contractAddress, tokenDeposit)
        .send({ from: partyA})
      expect(transactionHash).to.exist
      const { status } = await client
        .channelManagerInstance
        .methods
        .deposit(
          subchanAI,
          partyA,
          tokenDeposit,
          true
        )
        .send({ from: partyA, gas: 750000 })
      expect(status).to.equal(true)
    }).timeout(45000)

    it('should get the untracked ERC20 deposits from hub', async () => {
      await interval(async (iterationNumber, stop) => {
        untrackedDeposits = await client.getUntrackedDeposits(subchanAI, partyA)
        if (untrackedDeposits !== [] && untrackedDeposits.length == 1) {
          stop()
        }
      }, 2000)
      expect(Web3.utils.toBN(untrackedDeposits[0].deposit).eq(tokenDeposit)).to.equal(true)
      expect(untrackedDeposits[0].recipient).to.equal(partyA.toLowerCase())
      console.log(`\nChannel values after chainsaw:`)
      chanA = await client.getChannelById(subchanAI)
      console.log(`ethBalanceA: ${chanA.ethBalanceA}`)
      console.log(`tokenBalanceA: ${chanA.tokenBalanceA}`)
      console.log(`nonce: ${chanA.nonce}`)
    }).timeout(45000)

    it('should post signed updates to hub', async () => {
      console.log(`\nFound ${untrackedDeposits.length} untracked deposits`)
      expectedNonce = chanA.nonce + untrackedDeposits.length
      response = await client.signUntrackedDeposits({
        channelId: subchanAI, 
        untrackedDeposits,
        sender: partyA
      })
      // recover signer
      chanA = await client.getChannelById(subchanAI)
      
      console.log('\nValues after deposits:')
      console.log('ethBalanceA:', chanA.ethBalanceA)
      console.log('tokenBalanceA:', chanA.tokenBalanceA)
      console.log('nonce:', chanA.nonce)

      console.log('\nsignUntrackedDeposits Response')
      console.log(response)

      expect(expectedTokenBalance.eq(Web3.utils.toBN(chanA.tokenBalanceA))).to.equal(true)
      expect(chanA.nonce).to.equal(expectedNonce)
    })

    it('partyA and hub should sign the untracked ERC20 deposit as a state update', async () => {
      // generate expected hash
      chanA = await client.getChannelById(subchanAI)
      const ethBalanceA = Web3.utils.toBN(chanA.ethBalanceA)
      const tokenBalanceA = Web3.utils.toBN(chanA.tokenBalanceA)
      let signer = Connext.recoverSignerFromChannelStateUpdate({
        sig: response[0].sigA,
        channelId: subchanAI,
        isClose: false,
        nonce: chanA.nonce,
        openVcs: chanA.openVcs,
        vcRootHash: chanA.vcRootHash,
        partyA,
        partyI: ingridAddress,
        ethBalanceA,
        ethBalanceI: Web3.utils.toBN(chanA.ethBalanceI),
        tokenBalanceA,
        tokenBalanceI: Web3.utils.toBN(chanA.tokenBalanceI),
      })
      expect(signer.toLowerCase()).to.equal(partyA.toLowerCase())

      signer = Connext.recoverSignerFromChannelStateUpdate({
        sig: response[0].sigI,
        channelId: subchanAI,
        isClose: false,
        nonce: chanA.nonce,
        openVcs: chanA.openVcs,
        vcRootHash: chanA.vcRootHash,
        partyA,
        partyI: ingridAddress,
        ethBalanceA,
        ethBalanceI: Web3.utils.toBN(chanA.ethBalanceI),
        tokenBalanceA,
        tokenBalanceI: Web3.utils.toBN(chanA.tokenBalanceI),
      })
      expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
    })
  })

  describe('testing new deposit flow', () => {
    subchanBI = subchanBI 
      ? subchanBI 
      : '0xf2fb578207baf9a19c0f8b21b1da6d592bb8585b6fc8c7d32eed21fbea06fe68'
    const ethDeposit = Web3.utils.toBN(Web3.utils.toWei('1', 'ether'))
    const tokenDeposit = Web3.utils.toBN('1')
    
    let expectedToken, expectedEth
    before('set expected balances', async () => {
      chanB = await client.getChannelById(subchanBI)
      expectedToken = Web3.utils.toBN(chanB.tokenBalanceA).add(tokenDeposit)
      expectedEth = Web3.utils.toBN(chanB.ethBalanceA).add(ethDeposit)
      console.log('expectedEth:', expectedEth.toString())
    })
    
    it('should deposit ETH into subchanBI and post to hub', async () => {
      const response = await client.deposit(
        { ethDeposit },
        partyB
      )
      console.log('response:', response)
      chanB = await client.getChannelById(subchanBI)
      expect(expectedEth.eq(Web3.utils.toBN(chanB.ethBalanceA))).to.equal(true)    
    }).timeout(45000)

    it('should deposit ERC20 into subchanBI and post to hub', async () => {
      // approve transfer
      const { status } = await token.methods
        .approve(contractAddress, tokenDeposit)
        .send({ from: partyB })
      expect(status).to.equal(true)
      // call deposit
      const response = await client.deposit(
        { tokenDeposit },
        partyB,
        partyB,
        tokenAddress
      )
      console.log('response:', response)
      chanB = await client.getChannelById(subchanBI)
      expect(expectedToken.eq(Web3.utils.toBN(chanB.tokenBalanceA))).to.equal(true)       
    }).timeout(45000)

  })

  describe.skip('exchanging ETH and ERC20', async () => {
    const exchangeRate = Web3.utils.toBN('2') // units: WEI / ERC20
    const token = new web3.eth.Contract(tokenAbi, tokenAddress)
    it('request hub deposit right amount of tokens while endpoint down in chanA ETH --> ERC', async () => {
      const hubTokenBal = await token.methods.balanceOf(ingridAddress).call()
      subchanAI = subchanAI 
        ? subchanAI 
        : '0x99238aa88a6824cd2e363220ad525e55613151aeeb842e5f7d62c699ee6f5a93'
      chanA = await client.getChannelById(subchanAI)
      // use an exchange rate so 1 WEI = 2 ERC20
      const exchangedEth = Web3.utils.toBN(chanA.ethBalanceA)
      // exchanging total of channel, but may use other amount
      const exchangedTokens = exchangedEth.div(exchangeRate)
      console.log('hubTokenBal:', hubTokenBal)
      console.log('requestedDeposit:', exchangedTokens.toString())
      const response = await client.requestHubDeposit({ channelId: subchanAI, deposit: {
        tokenDeposit: exchangedTokens
      }})
      await interval(async (iterationNumber, stop) => {
        chanA = await client.getChannelById(subchanAI)
        if (
          chanA != null && // exists
          chanA.state === 'LCS_OPENED' && // joined
          !Web3.utils.toBN(chanA.tokenBalanceI).isZero()
        ) {
          stop()
        }
      }, 2000)
      expect(exchangedTokens.eq(Web3.utils.toBN(chanA.tokenBalanceI))).to.equal(true)
    }).timeout(45000)

    it('request hub deposit right amount of ETH while endpoint down in chanB ERC --> ETH', async () => {
      let token = new web3.eth.Contract(tokenAbi, tokenAddress)
      const hubTokenBal = await token.methods.balanceOf(ingridAddress).call()
      subchanBI = subchanBI 
        ? subchanBI 
        : '0x99238aa88a6824cd2e363220ad525e55613151aeeb842e5f7d62c699ee6f5a93'
      chanB = await client.getChannelById(subchanBI)
      // use an exchange rate so 1 WEI = 2 ERC20
      const exchangedTokens = Web3.utils.toBN(chanB.tokenBalanceA)
      // exchanging total of channel, but may use other amount
      const exchangedEth = exchangedTokens.mul(exchangeRate)
      console.log('hubTokenBal:', hubTokenBal)
      console.log('requestedDeposit:', exchangedEth.toString())
      const response = await client.requestHubDeposit({ channelId: subchanBI, deposit: {
        ethDeposit: exchangedEth
      }})
      await interval(async (iterationNumber, stop) => {
        chanB = await client.getChannelById(subchanBI)
        if (
          chanB != null && // exists
          chanB.state === 'LCS_OPENED' && // joined
          !Web3.utils.toBN(chanB.ethBalanceI).isZero()
        ) {
          stop()
        }
      }, 2000)
      expect(exchangedEth.eq(Web3.utils.toBN(chanB.ethBalanceI))).to.equal(true)
    }).timeout(45000)

    it('should use updateBalances of EXCHANGE type to get ERC20 for ETH in chanA', async () => {
      subchanAI = subchanAI 
        ? subchanAI 
        : '0x5b747222fed1650c5fe4042ebffcf7b1eb8974243b5e5a0aa3543e7c3dcff0e9'
      chanA = await client.getChannelById(subchanAI)
      // use an exchange rate so 1 WEI = 2 ERC20
      const exchangedEth = Web3.utils.toBN(chanA.ethBalanceA)
      // exchanging total of channel, but may use other amount
      const exchangedTokens = exchangedEth.div(exchangeRate)
      
      const newEthA = Web3.utils.toBN(chanA.ethBalanceA).sub(exchangedEth)
      const newTokenI = Web3.utils.toBN(chanA.tokenBalanceI).sub(exchangedTokens)
      const newEthI = Web3.utils.toBN(chanA.ethBalanceI).add(exchangedEth)
      const newTokenA = Web3.utils.toBN(chanA.tokenBalanceA).add(exchangedTokens)

      balanceA = {
        tokenDeposit: newTokenA,
        ethDeposit: newEthA,
      }

      balanceB = {
        tokenDeposit: newTokenI.isNeg() ? Web3.utils.toBN('0') : newTokenI,
        ethDeposit: newEthI.isNeg() ? Web3.utils.toBN('0') : newEthI,
      }

      const response = await client.updateBalances(
        [
          {
            type: 'EXCHANGE',
            payment: {
              channelId: chanA.channelId,
              balanceA,
              balanceB,
            },
            meta: { exchangeRate }
          }
        ],
        partyA
      )
      expect(response[0].type).to.equal('EXCHANGE')
    })

    it('should use updateBalances of EXCHANGE type to get ETH for ERC20 in chanB', async () => {
      subchanBI = subchanBI 
        ? subchanBI 
        : '0x4c5464186a41eded209d884a38db39ece2884ade578da986e06fbcd0e89e6fa4'
      
      chanB = await client.getChannelById(subchanBI)
      // use an exchange rate in WEI / ERC20
      const exchangedTokens = Web3.utils.toBN(chanB.tokenBalanceA)
      const exchangedEth = exchangedTokens.mul(exchangeRate)
      
      const newEthA = Web3.utils.toBN(chanB.ethBalanceA).add(exchangedEth)
      const newTokenI = Web3.utils.toBN(chanB.tokenBalanceI).add(exchangedTokens)
      const newEthI = Web3.utils.toBN(chanB.ethBalanceI).sub(exchangedEth)
      const newTokenA = Web3.utils.toBN(chanB.tokenBalanceA).sub(exchangedTokens)

      balanceA = {
        tokenDeposit: newTokenA,
        ethDeposit: newEthA,
      }

      balanceB = {
        tokenDeposit: newTokenI.isNeg() ? Web3.utils.toBN('0') : newTokenI,
        ethDeposit: newEthI.isNeg() ? Web3.utils.toBN('0') : newEthI,
      }

      const response = await client.updateBalances(
        [
          {
            type: 'EXCHANGE',
            payment: {
              channelId: chanB.channelId,
              balanceA,
              balanceB,
            },
            meta: { exchangeRate }
          }
        ],
        partyB
      )
      expect(response[0].type).to.equal('EXCHANGE')
    })
  })
})

describe.skip('Connext happy case ERC20 testing flow', () => {
  before('authenticate', async () => {
    accounts = await web3.eth.getAccounts()
    ingridAddress = accounts[0]
    partyA = accounts[1]
    partyB = accounts[2]
    partyC = accounts[3]
    partyD = accounts[4]
    partyE = accounts[5]

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

    expect(authJson).to.not.deep.equal({})

    // init client instance
    client = new Connext({
      web3,
      ingridAddress,
      watcherUrl,
      ingridUrl,
      contractAddress
    })

    // make sure auth works
    const challenge = await client.getChallengeTimer()
    expect(challenge).to.equal(3600)
  })

  const balDenominator = Web3.utils.toBN('100')

  describe('Registering with the hub', () => {
    
    describe('registering partyA with hub', () => {
      let token, balanceA, balanceB, balanceC, balanceD, balanceE
      let initialTokenDeposit
      
      it('should approve all requisite token transfers', async () => {
        // approve token transfers
        token = new web3.eth.Contract(tokenAbi, tokenAddress)
        balanceA = await token.methods.balanceOf(partyA).call()
        balanceB = await token.methods.balanceOf(partyB).call()
        balanceC = await token.methods.balanceOf(partyC).call()
        balanceD = await token.methods.balanceOf(partyD).call()
        balanceE = await token.methods.balanceOf(partyE).call()
        initialTokenDeposit = Web3.utils.toBN(balanceA).div(balDenominator)
        let tokenApproval = await token.methods
          .approve(contractAddress, initialTokenDeposit)
          .send( {
          from: partyA,
          gas: 750000
        })
        console.log('$$$$$$$$$$$$$$$$$')
        console.log(typeof balanceA)
        console.log(balanceA)
        console.log(tokenApproval.events.Approval.returnValues)
        expect(tokenApproval.status).to.be.equal(true)
        initialTokenDeposit = Web3.utils.toBN(balanceB).div(balDenominator)
        tokenApproval = await token.methods
          .approve(contractAddress, initialTokenDeposit)
          .send( {
          from: partyB,
          gas: 750000
        })
        expect(tokenApproval.status).to.be.equal(true)
        initialTokenDeposit = Web3.utils.toBN(balanceC).div(balDenominator)
        tokenApproval = await token.methods
          .approve(contractAddress, initialTokenDeposit)
          .send( {
          from: partyC,
          gas: 750000
        })
        expect(tokenApproval.status).to.be.equal(true)
        initialTokenDeposit = Web3.utils.toBN(balanceD).div(balDenominator)
        tokenApproval = await token.methods
          .approve(contractAddress, initialTokenDeposit)
          .send( {
          from: partyD,
          gas: 750000
        })
        expect(tokenApproval.status).to.be.equal(true)
        initialTokenDeposit = Web3.utils.toBN(balanceE).div(balDenominator)
        tokenApproval = await token.methods
          .approve(contractAddress, initialTokenDeposit)
          .send( {
          from: partyE,
          gas: 750000
        })
        expect(tokenApproval.status).to.be.equal(true)
      }).timeout(45000)

      it
        (
          'should create a ledger channel with the hub and partyA and wait for chainsaw',
          async () => {
            const balance = await token.methods.balanceOf(partyA).call()
            const initialDeposit = {
              tokenDeposit: Web3.utils.toBN(balance).div(balDenominator)
            }
            subchanAI = await client.openChannel(initialDeposit, tokenAddress, partyA)
            // ensure lc is in the database
            await interval(async (iterationNumber, stop) => {
              chanA = await client.getChannelById(subchanAI)
              if (chanA != null) {
                stop()
              }
            }, 2000)
            expect(chanA.channelId).to.be.equal(subchanAI)
            expect(Web3.utils.toBN(chanA.tokenBalanceA).eq(initialDeposit.tokenDeposit)).to.equal(true)
            expect(chanA.token.toLowerCase()).to.equal(tokenAddress.toLowerCase())
          }
        )
        .timeout(45000)

      it
        ('hub should have autojoined chanA', async () => {
          // ensure lc is in the database
          await interval(async (iterationNumber, stop) => {
            chanA = await client.getChannelById(subchanAI)
            if (chanA.state != 'LCS_OPENING') {
              stop()
            }
          }, 2000)
          expect(chanA.state).to.be.equal('LCS_OPENED')
        })
        .timeout(45000)

      it('hub should have 0 balance in chanA', async () => {
        const tokenBalanceI = Web3.utils.toBN(chanA.tokenBalanceI)
        expect(tokenBalanceI.eq(Web3.utils.toBN('0'))).to.equal(true)
      })

      it('client should have initialDeposit in chanA', async () => {
        const initialDeposit = {
          tokenDeposit: Web3.utils.toBN(balanceA).div(balDenominator)
        }
        console.log('****')
        console.log('chanA:', JSON.stringify(chanA))
        const tokenBalanceA = Web3.utils.toBN(chanA.tokenBalanceA)
        expect(tokenBalanceA.eq(initialDeposit.tokenDeposit)).to.equal(true)
      })

      it('should return the contract address', async () => {
        const addr = await client.getContractAddress(subchanAI)
        expect(addr).to.equal(contractAddress)
      })
    })

    describe('registering partyB with hub', () => {
      it('should create a ledger channel with the hub and partyB', async () => {
        const initialDeposit = {
          tokenDeposit: Web3.utils.toBN('0')
        }
        subchanBI = await client.openChannel(initialDeposit, tokenAddress, partyB)
        // ensure lc is in the database
        await interval(async (iterationNumber, stop) => {
          chanB = await client.getChannelById(subchanBI)
          if (chanB != null) {
            stop()
          }
        }, 2000)
        expect(chanB.channelId).to.be.equal(subchanBI)
      }).timeout(45000)

      it('hub should have autojoined channel', async () => {
        await interval(async (iterationNumber, stop) => {
          chanB = await client.getChannelById(subchanBI)
          if (chanB.state != 'LCS_OPENING') {
            stop()
          }
        }, 2000)
        expect(chanB.state).to.be.equal('LCS_OPENED')
      }).timeout(45000)

      it('hub should have 0 balance in chanB', async () => {
        const tokenBalanceI = Web3.utils.toBN(chanB.tokenBalanceI)
        expect(tokenBalanceI.eq(Web3.utils.toBN('0'))).to.equal(true)
      })

      it('client should have 0 balance in chanB', async () => {
        const tokenBalanceA = Web3.utils.toBN(chanB.tokenBalanceA)
        expect(
          tokenBalanceA.eq(Web3.utils.toBN('0'))
        ).to.equal(true)
      })
    })

    describe('register partyC, partyD, and partyE with hub', () => {
      let token
      before('balances and token instantiation', async () => {
        token = new web3.eth.Contract(tokenAbi, tokenAddress)
      })
      it(
        'should create a ledger channel with the hub and partyC, partyD, and partyE',
        async () => {
          
          const balance = await token.methods.balanceOf(partyC).call()
          const initialDeposit = {
            tokenDeposit: Web3.utils.toBN(balance).div(balDenominator)
          }
          subchanCI = await client.openChannel(initialDeposit, tokenAddress, partyC)
          subchanDI = await client.openChannel(initialDeposit, tokenAddress, partyD)
          subchanEI = await client.openChannel(initialDeposit, tokenAddress, partyE)
          // ensure lc is in the database
          await interval(async (iterationNumber, stop) => {
            chanC = await client.getChannelById(subchanCI)
            if (chanC != null) {
              stop()
            }
          }, 2000)
          chanD = await client.getChannelById(subchanDI)
          chanE = await client.getChannelById(subchanEI)
          expect(chanC.channelId).to.be.equal(subchanCI)
          expect(chanD.channelId).to.be.equal(subchanDI)
          expect(chanE.channelId).to.be.equal(subchanEI)
        }
      ).timeout(45000)

      it('hub should have autojoined channels', async () => {
        await interval(async (iterationNumber, stop) => {
          chanC = await client.getChannelById(subchanCI)
          if (chanC.state != 'LCS_OPENING') {
            stop()
          }
        }, 2000)
        chanD = await client.getChannelById(subchanDI)
        chanE = await client.getChannelById(subchanEI)
        expect(chanC.state).to.be.equal('LCS_OPENED')
        expect(chanD.state).to.be.equal('LCS_OPENED')
        expect(chanE.state).to.be.equal('LCS_OPENED')
      }).timeout(45000)

      it('hub should have 0 balance in all channels', async () => {
        const tokenBalanceCI = Web3.utils.toBN(chanC.tokenBalanceI)
        expect(tokenBalanceCI.eq(Web3.utils.toBN('0'))).to.equal(true)
        const tokenBalanceDI = Web3.utils.toBN(chanD.tokenBalanceI)
        expect(tokenBalanceDI.eq(Web3.utils.toBN('0'))).to.equal(true)
        const tokenBalanceEI = Web3.utils.toBN(chanE.tokenBalanceI)
        expect(tokenBalanceEI.eq(Web3.utils.toBN('0'))).to.equal(true)
      })
    })

    describe('registration error cases', async () => {
      it('should throw an error if you have open and active LC', async () => {
        const initialDeposit = {
          ethDeposit: Web3.utils.toBN(Web3.utils.toWei('6', 'ether'))
        }
        try {
          await client.openChannel(initialDeposit, null, partyA)
        } catch (e) {
          expect(e.statusCode).to.equal(401)
          expect(e.name).to.equal('ChannelOpenError')
          expect(e.methodName).to.equal('openChannel')
        }
      })
    })
  })

  describe('Requesting hub deposit', () => {

    it(
      'request hub deposits into chanB for all viewer chan.tokenBalanceA',
      async () => {
        chanA = await client.getChannelByPartyA(partyA)
        chanC = await client.getChannelByPartyA(partyC)
        chanD = await client.getChannelByPartyA(partyD)
        chanE = await client.getChannelByPartyA(partyE)
        console.log('@@@@@@@@@@@@@@@@@@@')
        console.log('client tokenAddress:', tokenAddress)
        console.log('chanA:', JSON.stringify(chanA))

        // const token = new web3.eth.Contract(tokenAbi, tokenAddress)
        const tokenDeposit = Web3.utils
          .toBN(chanA.tokenBalanceA)
          // .toBN(Web3.utils.toWei('6', 'ether'))
          .add(Web3.utils.toBN(chanC.tokenBalanceA))
          .add(Web3.utils.toBN(chanD.tokenBalanceA))
          .add(Web3.utils.toBN(chanE.tokenBalanceA))
          .mul(Web3.utils.toBN('3'))
        // const tokenApproval = await token.methods
        //   .approve(contractAddress, tokenDeposit)
        //   .send( {
        //   from: ingridAddress,
        //   gas: 750000
        // })
        // console.log('************************')
        // expect(tokenApproval.status).to.equal(true)
        // const resp = await client.channelManagerInstance.methods
        //   .deposit(chanA.channelId, ingridAddress, tokenDeposit, true)
        //   .send({
        //     from: ingridAddress,
        //     gas: 750000
        //   })
        // console.log(resp)
        // multiple to avoid autoDeposit on vc creation
        console.log('Requesting tokenDeposit:', tokenDeposit.toString())
        console.log('Depositing into channel:', JSON.stringify(subchanBI))
        const response = await client.requestHubDeposit({
          channelId: subchanBI,
          deposit: {
            tokenDeposit
          }
        })
        await interval(async (iterationNumber, stop) => {
          console.log('iterationNumber:', iterationNumber)
          chanB = await client.getChannelById(subchanBI)
          if (
            chanB != null && // exists
            chanB.state === 'LCS_OPENED' && // joined
            !Web3.utils.toBN(chanB.tokenBalanceI).isZero()
          ) {
            stop()
          }
        }, 2000)
        expect(tokenDeposit.eq(Web3.utils.toBN(chanB.tokenBalanceI))).to.equal(true)
      }
    ).timeout(60000)

    it('should throw an error if hub has insufficient funds', async () => {
      const balance = await client.web3.eth.getBalance(ingridAddress)
      const tokenDeposit = Web3.utils
        .toBN(balance)
        .add(Web3.utils.toBN(Web3.utils.toWei('1000', 'ether')))
      try {
        await client.requestHubDeposit({
          channelId: subchanBI,
          deposit: {
            tokenDeposit
          }
        })
      } catch (e) {
        expect(e.statusCode).to.equal(500)
      }
    })
  })

  describe.skip('Creating a virtual channel', () => {
    describe('openThread between partyA and partyB', () => {
      // put 1/10 of channel balance into thread
      const balDenominator = Web3.utils.toBN('2')
      let initialDeposit
      it('should create a new virtual channel between partyA and partyB', async () => {
        chanA = await client.getChannelById(subchanAI)

        initialDeposit = {
          tokenDeposit: Web3.utils.toBN(chanA.tokenBalanceA).div(balDenominator)
        }
        
        threadIdA = await client.openThread({
          to: partyB,
          sender: partyA,
          deposit: initialDeposit
        })

        threadA = await client.getThreadById(threadIdA)
        expect(threadA.channelId).to.equal(threadIdA)
      })

      it('balanceA in chanA should be half of previous', async () => {
        chanA = await client.getChannelById(subchanAI)
        expect(
          initialDeposit.tokenDeposit
          .eq(Web3.utils.toBN(chanA.tokenBalanceA))
        ).to.equal(true)
      })

      it('hub should countersign proposed LC update', async () => {
        let state = await client.getLatestChannelState(subchanAI)
        // recover signer from sigI
        const signer = Connext.recoverSignerFromChannelStateUpdate({
          sig: state.sigI,
          isClose: false,
          channelId: subchanAI,
          nonce: state.nonce,
          openVcs: state.openVcs,
          vcRootHash: state.vcRootHash,
          partyA: partyA,
          partyI: ingridAddress,
          ethBalanceA: Web3.utils.toBN(state.ethBalanceA),
          ethBalanceI: Web3.utils.toBN(state.ethBalanceI),
          tokenBalanceA: Web3.utils.toBN(state.tokenBalanceA),
          tokenBalanceI: Web3.utils.toBN(state.tokenBalanceI)
        })
        expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
      })

      it('hub should create update for chanB', async () => {
        threadA = await client.getThreadById(threadIdA)
        let state = await client.getLatestChannelState(subchanBI, ['sigI'])
        const signer = Connext.recoverSignerFromChannelStateUpdate({
          sig: state.sigI,
          isClose: false,
          channelId: subchanBI,
          nonce: state.nonce,
          openVcs: state.openVcs,
          vcRootHash: state.vcRootHash,
          partyA: partyB,
          partyI: ingridAddress,
          ethBalanceA: Web3.utils.toBN(state.ethBalanceA),
          ethBalanceI: Web3.utils.toBN(state.ethBalanceI),
          tokenBalanceA: Web3.utils.toBN(state.tokenBalanceA),
          tokenBalanceI: Web3.utils.toBN(state.tokenBalanceI)
        })
        expect(signer.toLowerCase()).to.equal(ingridAddress.toLowerCase())
      })
    })

    describe('partyB should be able to recieve multiple openThread updates', () => {
      it('should create a new virtual channel between partyC and partyB', async () => {
        threadIdC = await client.openThread({ to: partyB, sender: partyC })
        threadC = await client.getThreadById(threadIdC)
        expect(threadC.channelId).to.equal(threadIdC)
      })

      it('should create a new virtual channel between partyD and partyB', async () => {
        threadIdD = await client.openThread({ to: partyB, sender: partyD })
        threadD = await client.getThreadById(threadIdD)
        expect(threadD.channelId).to.equal(threadIdD)
      })
    })
  })

  describe.skip('Updating balances in a channel', async () => {
    // fraction of total thread balance going into update
    const balDenominator = Web3.utils.toBN('20')
    it('should call updateBalances in threadA', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      const balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      const balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      const response = await client.updateBalances(
        [
          {
            type: 'VIRTUAL',
            payment: {
              channelId: threadIdA,
              balanceA,
              balanceB
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
        ],
        partyA
      )
      threadA = await client.getThreadById(threadIdA)
      expect(
        Web3.utils.toBN(threadA.ethBalanceA).eq(balanceA.tokenDeposit)
      ).to.equal(true)
      expect(
        Web3.utils.toBN(threadA.ethBalanceB).eq(balanceB.tokenDeposit)
      ).to.equal(true)
    })

    it('partyA should properly sign the proposed update', async () => {
      const state = await client.getLatestThreadState(threadIdA)
      const signer = Connext.recoverSignerFromThreadStateUpdate({
        sig: state.sigA,
        channelId: threadIdA,
        nonce: state.nonce,
        partyA: partyA,
        partyB: partyB,
        ethBalanceA: Web3.utils.toBN(state.ethBalanceA),
        ethBalanceB: Web3.utils.toBN(state.ethBalanceB),
        tokenBalanceA: Web3.utils.toBN(state.tokenBalanceA),
        tokenBalanceB: Web3.utils.toBN(state.tokenBalanceB)
      })
      expect(signer.toLowerCase()).to.equal(partyA.toLowerCase())
    })

    it('partyA should be able to send multiple state updates in a row', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB)
      }
      for (let i = 0; i < 10; i++) {
        balanceA.tokenDeposit = balanceA.tokenDeposit.sub(
          balDiff
        )
        balanceB.tokenDeposit = balanceB.tokenDeposit.add(
          balDiff
        )
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                balanceA,
                balanceB,
                channelId: threadIdA
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
          ],
          partyA
        )
      }
      threadA = await client.getThreadById(threadIdA)
      expect(
        balanceA.tokenDeposit.eq(Web3.utils.toBN(threadA.tokenBalanceA))
      ).to.equal(true)
      expect(
        balanceB.tokenDeposit.eq(Web3.utils.toBN(threadA.tokenBalanceB))
      ).to.equal(true)
    })

    it('should be able to send ledger and virtual channel updates simultaneously', async () => {
      threadA = await client.getThreadById(threadIdA)
      chanA = await client.getChannelById(subchanAI)
      chanB = await client.getChannelById(subchanBI)
      expect(chanB.state).to.equal('LCS_OPENED')
      expect(chanA.state).to.equal('LCS_OPENED')
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      const vcA1 = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }

      const lcA1 = {
        tokenDeposit: Web3.utils.toBN(chanA.tokenBalanceA).sub(balDiff)
      }

      const vcB1 = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      const lcI1 = {
        tokenDeposit: Web3.utils.toBN(chanA.tokenBalanceI).add(balDiff)
      }

      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadIdA,
            balanceA: vcA1,
            balanceB: vcB1
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
            channelId: subchanAI,
            balanceA: lcA1,
            balanceB: lcI1
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

      const responses = await client.updateBalances(payments, partyA)
      expect(responses).to.have.lengthOf(2)
      for (const r of responses) {
        expect(r.id).to.exist
      }
      // verify new balances
      threadA = await client.getThreadById(threadIdA)
      chanA = await client.getChannelById(subchanAI)
      // vc
      expect(threadA.nonce).to.equal(responses[0].nonce)
      expect(threadA.tokenBalanceA).to.equal(responses[0].tokenBalanceA)
      expect(threadA.tokenBalanceB).to.equal(responses[0].tokenBalanceB)
      // lc
      expect(chanA.nonce).to.equal(responses[1].nonce)
      expect(chanA.tokenBalanceA).to.equal(responses[1].tokenBalanceA)
      expect(chanA.tokenBalanceI).to.equal(responses[1].tokenBalanceI)
    })

    it('should not prohibit the creation of a virtual channel', async () => {
      threadIdE = await client.openThread({ to: partyB, sender: partyE })
      threadE = await client.getThreadById(threadIdE)
      expect(threadE.channelId).to.equal(threadIdE)
    })

    it('partyB should be able to recieve state updates across multiple vcs', async () => {
      threadC = await client.getThreadByParties({ partyA: partyC, partyB })
      threadD = await client.getThreadByParties({ partyA: partyD, partyB })
      let balDiff = Web3.utils.toBN(threadC.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadC.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadC.tokenBalanceB).add(balDiff)
      }
      await client.updateBalances(
        [
          {
            type: 'VIRTUAL',
            payment: {
              channelId: threadC.channelId,
              balanceA,
              balanceB
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
        ],
        partyC
      )
      balDiff = Web3.utils.toBN(threadD.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadD.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadD.tokenBalanceB).add(balDiff)
      }
      await client.updateBalances(
        [
          {
            type: 'VIRTUAL',
            payment: {
              channelId: threadD.channelId,
              balanceA,
              balanceB
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
        ],
        partyD
      )
      // multiple balance updates
      for (let i = 0; i < 10; i++) {
        balanceA.tokenDeposit = balanceA.tokenDeposit.add(
          balDiff
        )
        balanceB.tokenDeposit = balanceB.tokenDeposit.sub(
          balDiff
        )
        const sender = i % 2 === 0 ? partyC : partyD
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: i % 2 === 0 ? threadC.channelId : threadD.channelId,
                balanceA,
                balanceB
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
          ],
          sender
        )
      }
      threadD = await client.getThreadById(threadD.channelId)
      expect(
        Web3.utils.toBN(threadD.tokenBalanceA).eq(balanceA.tokenDeposit)
      ).to.equal(true)
      expect(
        Web3.utils.toBN(threadD.tokenBalanceB).eq(balanceB.tokenDeposit)
      ).to.equal(true)
    })

    it('should throw an error if the balanceB decreases', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).add(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).sub(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
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
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(550)
      }
    })

    it('should throw an error if no purchaseMeta receiver is included', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'TIP',
                fields: {
                  streamId: 6969,
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if an improper purchaseMeta receiver is provided', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                receiver: 'nope',
                type: 'TIP',
                fields: {
                  streamId: 6969,
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if no purchaseMeta type is provided', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                fields: {
                  streamId: 6969,
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if an improper purchaseMeta type is provided', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'fail',
                fields: {
                  streamId: 6969,
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if TIP purchaseMETA is missing the fields object', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'TIP'
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if TIP purchaseMETA is missing a fields.streamId', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'fail',
                fields: {
                  performerId: 1337,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if TIP purchaseMETA is missing the fields.performerId', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'fail',
                fields: {
                  streamId: 6969,
                  performerName: 'Agent Smith'
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if TIP purchaseMETA is missing the fields.performerName', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                type: 'fail',
                fields: {
                  streamId: 6969,
                  performerId: 1337
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if a PURCHASE purchaseMeta has no fields', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
                type: 'PURCHASE'
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if a PURCHASE purchaseMeta has no fields.productSku', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
                type: 'PURCHASE',
                fields: {
                  productSku: 6969
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })

    it('should throw an error if a PURCHASE purchaseMeta has no fields.productName', async () => {
      threadA = await client.getThreadById(threadIdA)
      const balDiff = Web3.utils.toBN(threadA.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceA).sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils.toBN(threadA.tokenBalanceB).add(balDiff)
      }
      try {
        await client.updateBalances(
          [
            {
              type: 'VIRTUAL',
              payment: {
                channelId: threadA.channelId,
                balanceA,
                balanceB
              },
              purchaseMeta: {
                receiver: '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
                type: 'PURCHASE',
                fields: {
                  productSku: 6969
                }
              }
            }
          ],
          partyA
        )
      } catch (e) {
        expect(e.statusCode).to.equal(200)
      }
    })
  })

  describe.skip('Closing a virtual channel', () => {
    it('should change threadA status to settled', async () => {
      threadA = await client.getThreadByParties({ partyA, partyB })
      const response = await client.closeThread(threadA.channelId, partyA)
      // get threadA
      threadA = await client.getThreadById(threadA.channelId)
      expect(threadA.state).to.equal('VCS_SETTLED')
    })

    it('should increase chanA balanceA by threadA.balanceA remainder', async () => {
      // get objs
      chanA = await client.getChannelByPartyA(partyA)
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: chanA.channelId,
        nonce: chanA.nonce - 1
      })
      const expectedBalA = Web3.utils
        .toBN(prevState.tokenBalanceA)
        .add(Web3.utils.toBN(threadA.tokenBalanceA))
      expect(expectedBalA.eq(Web3.utils.toBN(chanA.tokenBalanceA))).to.equal(true)
    })

    it('should increase chanA balanceI by threadA.balanceB', async () => {
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: chanA.channelId,
        nonce: chanA.nonce - 1
      })
      const expectedBalI = Web3.utils
        .toBN(prevState.tokenBalanceI)
        .add(Web3.utils.toBN(threadA.tokenBalanceB))
      expect(expectedBalI.eq(Web3.utils.toBN(chanA.tokenBalanceI))).to.equal(true)
    })

    it('should increase chanB balanceA by threadA.balanceB', async () => {
      // get objs
      chanB = await client.getChannelByPartyA(partyB)
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: subchanBI,
        nonce: chanB.nonce - 1
      })
      const expectedBalA = Web3.utils
        .toBN(prevState.tokenBalanceA)
        .add(Web3.utils.toBN(threadA.tokenBalanceB))
      expect(expectedBalA.eq(Web3.utils.toBN(chanB.tokenBalanceA))).to.equal(true)
    })

    it('should decrease chanB balanceI by threadA.balanceA', async () => {
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: subchanBI,
        nonce: chanB.nonce - 1
      })
      const expectedBalI = Web3.utils
        .toBN(prevState.tokenBalanceI)
        .add(Web3.utils.toBN(threadA.tokenBalanceA))
      expect(expectedBalI.eq(Web3.utils.toBN(chanB.tokenBalanceI))).to.equal(true)
    })

    it('should not interrupt the flow of other vcs', async () => {
      threadC = await client.getThreadByParties({ partyA: partyC, partyB })
      const balDenominator = Web3.utils.toBN('10')
      const balDiff = Web3.utils.toBN(threadC.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils
          .toBN(threadC.tokenBalanceA)
          .sub(balDiff)
      }
      balanceB = {
        tokenDeposit: Web3.utils
          .toBN(threadC.tokenBalanceB)
          .add(balDiff)
      }

      const payments = [
        {
          type: 'VIRTUAL',
          payment: {
            channelId: threadC.channelId,
            balanceA,
            balanceB
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
      await client.updateBalances(payments, partyC)
      threadC = await client.getThreadById(threadC.channelId)
      expect(
        balanceA.tokenDeposit.eq(Web3.utils.toBN(threadC.tokenBalanceA))
      ).to.equal(true)
    })

    it('partyB should be able to close a channel', async () => {
      threadC = await client.getThreadByParties({ partyA: partyC, partyB })
      const response = await client.closeThread(threadC.channelId, partyB)
      // get vc
      threadC = await client.getThreadById(threadC.channelId)
      expect(threadC.state).to.equal('VCS_SETTLED')
    })

    // ensure math stays the same
    it('should increase chanC balanceA by threadC.balanceA remainder', async () => {
      // get objs
      chanC = await client.getChannelByPartyA(partyC)
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: chanC.channelId,
        nonce: chanC.nonce - 1
      })
      const expectedBalA = Web3.utils
        .toBN(prevState.tokenBalanceA)
        .add(Web3.utils.toBN(threadC.tokenBalanceA))
      expect(expectedBalA.eq(Web3.utils.toBN(chanC.tokenBalanceA))).to.equal(true)
    })

    it('should increase chanC balanceI by threadC.balanceB', async () => {
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: chanC.channelId,
        nonce: chanC.nonce - 1
      })
      const expectedBalI = Web3.utils
        .toBN(prevState.tokenBalanceI)
        .add(Web3.utils.toBN(threadC.tokenBalanceB))
      expect(expectedBalI.eq(Web3.utils.toBN(chanC.tokenBalanceI))).to.equal(true)
    })

    it('should increase chanB balanceA by threadC.balanceB', async () => {
      // get objs
      chanB = await client.getChannelByPartyA(partyB)
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: subchanBI,
        nonce: chanB.nonce - 1
      })
      const expectedBalA = Web3.utils
        .toBN(prevState.tokenBalanceA)
        .add(Web3.utils.toBN(threadC.tokenBalanceB))
      expect(expectedBalA.eq(Web3.utils.toBN(chanB.tokenBalanceA))).to.equal(true)
    })

    it('should decrease chanB balanceI by threadA.balanceA', async () => {
      // calculate expected balance
      let prevState = await client.getChannelStateByNonce({
        channelId: subchanBI,
        nonce: chanB.nonce - 1
      })
      const expectedBalI = Web3.utils
        .toBN(prevState.tokenBalanceI)
        .add(Web3.utils.toBN(threadC.tokenBalanceA))
      expect(expectedBalI.eq(Web3.utils.toBN(chanB.tokenBalanceI))).to.equal(true)
    })

    it('partyB should be able to close multiple channels', async () => {
      threadD = await client.getThreadByParties({ partyA: partyD, partyB })
      threadE = await client.getThreadByParties({ partyA: partyE, partyB })
      const channelIds = [threadD.channelId, threadE.channelId]
      const results = await client.closeThreads(channelIds, partyB)

      // refetch channels
      threadD = await client.getThreadById(threadD.channelId)
      threadE = await client.getThreadById(threadE.channelId)

      expect(threadD.state).to.equal('VCS_SETTLED')
      expect(threadE.state).to.equal('VCS_SETTLED')
    })
  })

  describe.skip('Closing a ledger channel', () => {
    let prevBalA, finalBalA, prevBalI, finalBalI

    let token
    before('Create a virtual channel that has not been closed', async () => {
      token = new web3.eth.Contract(tokenAbi, tokenAddress)
      threadIdC = await client.openThread({ to: partyB, sender: partyC })
      threadC = await client.getThreadById(threadIdC)
    })

    it(`should close partyA's LC with the fast close flag`, async () => {
      prevBalA = await await token.methods.balanceOf(partyA).call()
      prevBalI = await token.methods.balanceOf(partyA).call()
      // send tx
      const response = await client.closeChannel(partyA)
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyA.toLowerCase())
    }).timeout(8000)

    it(`should transfer balanceA of partyA's lc into wallet`, async () => {
      chanA = await client.getChannelByPartyA(partyA)
      const expected = Web3.utils.toBN(chanA.tokenBalanceA).add(Web3.utils.toBN(prevBalA))
      finalBalA = await token.methods.balanceOf(partyA).call(),
      expect(Math.round(expected)).to.equal(Math.round(finalBalA))
    })

    it(`should transfer balanceI of lc into hubs wallet`, async () => {
      const expected =  Web3.utils.toBN(chanA.tokenBalanceI).add(Web3.utils.toBN(prevBalI))
      
      finalBalI =  await client.web3.eth.getBalance(ingridAddress)
      expect(Math.round(expected)).to.equal(Math.round(finalBalI))
    })

    it(`should not let you close an LC with openVCs`, async () => {
      try {
        const response = await client.closeChannel(partyB) // + 7 ETH
      } catch (e) {
        expect(e.statusCode).to.equal(600)
      }
    }).timeout(9000)

    it('should not interrupt the flow of open VCs', async () => {
      threadC = await client.getThreadByParties({ partyA: partyC, partyB })
      const balDenominator = Web3.utils.toBN('10')
      const balDiff = Web3.utils.toBN(threadC.tokenBalanceA).div(balDenominator)
      balanceA = {
        tokenDeposit: Web3.utils
          .toBN(threadC.tokenBalanceA)
          .sub(balDiff)
      }
      balanceB = {
        ethDeposit: Web3.utils
          .toBN(threadC.tokenBalanceB)
          .add(balDiff)
      }
      await client.updateBalances(
        [
          {
            type: 'VIRTUAL',
            payment: {
              channelId: threadC.channelId,
              balanceA,
              balanceB
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
        ],
        partyC
      )
      threadC = await client.getThreadById(threadC.channelId)
      expect(
        balanceA.tokenDeposit.eq(Web3.utils.toBN(threadC.tokenBalanceA))
      ).to.equal(true)
    })

    it(`should close partyC's LC with the fast close`, async () => {
      // close open vcs
      await client.closeThread(threadC.channelId, partyC)
      // send tx
      const response = await client.closeChannel(partyC)
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyC.toLowerCase())
    }).timeout(8000)

    it(`should close partyD's LC with the fast close`, async () => {
      // send tx
      const response = await client.closeChannel(partyD)
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyD.toLowerCase())
    }).timeout(8000)

    it(`should close partyE's LC with the fast close`, async () => {
      // send tx
      const response = await client.closeChannel(partyE)
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyE.toLowerCase())
    }).timeout(8000)

    it(`should close partyB's LC with the fast close`, async () => {
      prevBalA = await token.methods
        .balanceOf(partyB)
        .call() 
      const response = await client.closeChannel(partyB) 
      const tx = await client.web3.eth.getTransaction(response)
      expect(tx.to.toLowerCase()).to.equal(contractAddress)
      expect(tx.from.toLowerCase()).to.equal(partyB.toLowerCase())
    }).timeout(15000)

    it(`should transfer balanceA partyB's into wallet`, async () => {
      chanB = await client.getChannelByPartyA(partyB)
      const expected = Web3.utils.toBN(chanB.tokenBalanceA).add(Web3.utils.toBN(prevBalA))
      
      finalBal = await token.methods
        .balanceOf(partyB)
        .call() 
      expect(Math.round(expected)).to.equal(Math.round(finalBal))
    })
  })
})