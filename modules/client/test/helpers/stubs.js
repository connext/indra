const sinon = require('sinon')
const nock = require('nock')
const Web3 = require('web3')
const Connext = require('../../src/Connext')

export function createStubbedContract () {
  const sendTxStub = {
    send: sinon.stub().resolves({
      transactionHash: 'transactionHash',
      blockNumber: 'blockNumber'
    })
  }

  const contractMethods = {
    createChannel: sinon.stub().returns(sendTxStub),
    joinThread: sinon.stub().returns(sendTxStub),
    deposit: sinon.stub().returns(sendTxStub),
    consensusCloseChannel: sinon.stub().returns(sendTxStub),
    updateLCstate: sinon.stub().returns(sendTxStub),
    initVCstate: sinon.stub().returns(sendTxStub),
    settleVC: sinon.stub().returns(sendTxStub),
    closeVirtualChannel: sinon.stub().returns(sendTxStub),
    byzantineCloseChannel: sinon.stub().returns(sendTxStub)
  }

  return contractMethods
}

export async function createStubbedHub (
  baseUrl,
  channelType,
  threadType = 'NOT_UPDATED'
) {
  const web3 = new Web3('http://localhost:8545')
  const accounts = await web3.eth.getAccounts()
  const ingridAddress = accounts[0]
  const partyA = accounts[1]
  const partyB = accounts[2]
  const partyC = accounts[3]
  const partyD = accounts[4]
  // channel IDs
  const channelId1 =
    '0x1000000000000000000000000000000000000000000000000000000000000000'
  const channelId2 =
    '0x2000000000000000000000000000000000000000000000000000000000000000'
  const channelId3 =
    '0x3000000000000000000000000000000000000000000000000000000000000000'
  const channelId4 =
    '0x4000000000000000000000000000000000000000000000000000000000000000'

  // thread IDs
  const threadId1 =
    '0x0100000000000000000000000000000000000000000000000000000000000000'
  const threadId2 =
    '0x0200000000000000000000000000000000000000000000000000000000000000'
  const threadId3 =
    '0x0300000000000000000000000000000000000000000000000000000000000000'

  let stubHub = nock(baseUrl).persist(true)

  // get challenge timer
  stubHub
    // define the method to be intercepted
    .get('/ledgerchannel/challenge')
    // respond with a OK and the specified JSON response
    .reply(200, {
      challenge: 3600
    })

  // get open ledger channels by partyA
  switch (channelType) {
    case 'OPEN_LC_OPEN_VC':
      // partyA LC has ETH/TOKEN
      stubHub
        .get(`/ledgerchannel/a/${partyA.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, [
          {
            channelId: channelId1,
            partyA: partyA.toLowerCase(),
            partyI: ingridAddress.toLowerCase(),
            state: 'LCS_OPENED',
            ethBalanceA: Web3.utils.toWei('4', 'ether').toString(),
            ethBalanceI: '0',
            tokenBalanceA: Web3.utils.toWei('4', 'ether').toString(),
            tokenBalanceI: '0',
            nonce: 1,
            openVcs: 1,
            vcRootHash: Connext.generateThreadRootHash({
              threadInitialStates: [
                {
                  channelId: threadId1,
                  partyA: partyA.toLowerCase(),
                  partyB: partyB.toLowerCase(),
                  nonce: 0,
                  ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
                  ethBalanceB: '0',
                  tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
                  tokenBalanceB: '0'
                }
              ]
            })
          }
        ])
      // partyC LC has ETH only
      stubHub
        .get(`/ledgerchannel/a/${partyC.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, [
          {
            channelId: channelId3,
            partyA: partyC.toLowerCase(),
            partyI: ingridAddress.toLowerCase(),
            state: 'LCS_OPENED',
            ethBalanceA: Web3.utils.toWei('4', 'ether').toString(),
            ethBalanceI: '0',
            tokenBalanceA: '0',
            tokenBalanceI: '0',
            nonce: 1,
            openVcs: 1,
            vcRootHash: Connext.generateThreadRootHash({
              threadInitialStates: [
                {
                  channelId: threadId2, // eth only thread
                  partyA: partyC.toLowerCase(),
                  partyB: partyB.toLowerCase(),
                  nonce: 0,
                  ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
                  ethBalanceB: '0',
                  tokenBalanceA: '0',
                  tokenBalanceB: '0'
                }
              ]
            })
          }
        ])
      // partyD LC has TOKEN only
      stubHub
        .get(`/ledgerchannel/a/${partyD.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, [
          {
            channelId: channelId4,
            partyA: partyD.toLowerCase(),
            partyI: ingridAddress.toLowerCase(),
            state: 'LCS_OPENED',
            ethBalanceA: '0',
            ethBalanceI: '0',
            tokenBalanceA: Web3.utils.toWei('4', 'ether').toString(),
            tokenBalanceI: '0',
            nonce: 1,
            openVcs: 1,
            vcRootHash: Connext.generateThreadRootHash({
              threadInitialStates: [
                {
                  channelId: threadId3, // eth only thread
                  partyA: partyD.toLowerCase(),
                  partyB: partyB.toLowerCase(),
                  nonce: 0,
                  ethBalanceA: '0',
                  ethBalanceB: '0',
                  tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
                  tokenBalanceB: '0'
                }
              ]
            })
          }
        ])
      // partyB LC is recieving all threads
      stubHub
        .get(`/ledgerchannel/a/${partyB.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, [
          {
            channelId: channelId2,
            partyA: partyB.toLowerCase(),
            partyI: ingridAddress.toLowerCase(),
            state: 'LCS_OPENED',
            ethBalanceA: '0',
            ethBalanceI: Web3.utils.toWei('5', 'ether').toString(),
            tokenBalanceA: '0',
            tokenBalanceI: Web3.utils.toWei('5', 'ether').toString(),
            nonce: 3,
            openVcs: 3,
            vcRootHash: Connext.generateThreadRootHash({
              threadInitialStates: [
                {
                  channelId: threadId1, // eth + token thread
                  partyA: partyA.toLowerCase(),
                  partyB: partyB.toLowerCase(),
                  nonce: 0,
                  ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
                  ethBalanceB: '0',
                  tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
                  tokenBalanceB: '0'
                },
                {
                  channelId: threadId2, // eth only thread
                  partyA: partyC.toLowerCase(),
                  partyB: partyB.toLowerCase(),
                  nonce: 0,
                  ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
                  ethBalanceB: '0',
                  tokenBalanceA: '0',
                  tokenBalanceB: '0'
                },
                {
                  channelId: threadId3, // token only thread
                  partyA: partyD.toLowerCase(),
                  partyB: partyB.toLowerCase(),
                  nonce: 0,
                  ethBalanceA: '0',
                  ethBalanceB: '0',
                  tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
                  tokenBalanceB: '0'
                }
              ]
            })
          }
        ])
      break
    case 'OPEN_LC_NO_VC':
      stubHub
        .get(`/ledgerchannel/a/${partyA.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, [
          {
            channelId: '0x1000000000000000000000000000000000000000000000000000000000000000',
            partyA: partyA.toLowerCase(),
            partyI: ingridAddress.toLowerCase(),
            state: 'LCS_OPENED',
            ethBalanceA: Web3.utils.toWei('5', 'ether').toString(),
            ethBalanceI: '0',
            tokenBalanceA: Web3.utils.toWei('5', 'ether').toString(),
            tokenBalanceI: '0',
            nonce: 0,
            openVcs: 0,
            vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
          }
        ])
      stubHub
        .get(`/ledgerchannel/a/${partyB.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, [
          {
            channelId: '0x2000000000000000000000000000000000000000000000000000000000000000',
            partyA: partyB.toLowerCase(),
            partyI: ingridAddress.toLowerCase(),
            state: 'LCS_OPENED',
            ethBalanceA: Web3.utils.toWei('5', 'ether').toString(),
            ethBalanceI: '0',
            tokenBalanceA: Web3.utils.toWei('5', 'ether').toString(),
            tokenBalanceI: '0',
            nonce: 0,
            openVcs: 0,
            vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
          }
        ])
      break

    case 'NO_LC':
      stubHub
        .get(`/ledgerchannel/a/${partyA.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, {
          data: []
        })
      stubHub
        .get(`/ledgerchannel/a/${partyB.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, {
          data: []
        })
      stubHub
        .get(`/ledgerchannel/a/${partyC.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, {
          data: []
        })
      stubHub
        .get(`/ledgerchannel/a/${partyD.toLowerCase()}?status=LCS_OPENED`)
        .reply(200, {
          data: []
        })
      break

      case 'OPEN_LC_CLOSED_VC':
      // channel 1 - ETH/TOKEN (viewer)
      stubHub.get(`/ledgerchannel/a/${partyA.toLowerCase()}?status=LCS_OPENED`).reply(200, [{
        channelId: channelId1,
        partyA: partyA.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('4.9', 'ether').toString(),
        ethBalanceI: Web3.utils.toWei('0.1', 'ether').toString(),
        tokenBalanceA: Web3.utils.toWei('4.9', 'ether').toString(),
        tokenBalanceI: Web3.utils.toWei('0.1', 'ether').toString(),
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      }])

      // channel 2 - receiver
      stubHub.get(`/ledgerchannel/a/${partyB.toLowerCase()}?status=LCS_OPENED`).reply(200, [{
        channelId: channelId2,
        partyA: partyB.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('0.2', 'ether').toString(),
        ethBalanceI: '0',
        tokenBalanceA: Web3.utils.toWei('0.2', 'ether').toString(),
        tokenBalanceI: '0',
        nonce: 6, // open thread 1-3, close thread 1-3
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      }])

      // channel 3 - ETH (viewer)
      stubHub.get(`/ledgerchannel/a/${partyC.toLowerCase()}?status=LCS_OPENED`).reply(200, [{
        channelId: channelId3,
        partyA: partyC.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('4.9', 'ether').toString(),
        ethBalanceI: Web3.utils.toWei('0.1', 'ether').toString(),
        tokenBalanceA: '0',
        tokenBalanceI: '0',
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      }])

      // channel 4 - TOKEN (viewer)
      stubHub.get(`/ledgerchannel/a/${partyD.toLowerCase()}?status=LCS_OPENED`).reply(200, [{
        channelId: channelId4,
        partyA: partyD.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: '0',
        ethBalanceI: '0',
        tokenBalanceA: Web3.utils.toWei('4.9', 'ether').toString(),
        tokenBalanceI: Web3.utils.toWei('0.1', 'ether').toString(),
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      }])
      break

    default:
      break
  }

  // get vc initial states by lc id
  // get ledger channels by id
  switch (channelType) {
    case 'OPEN_LC_OPEN_VC':
      // add initial states endpoints
      stubHub.get(`/ledgerchannel/${channelId1}/vcinitialstates`).reply(200, [
        {
          channelId: threadId1,
          partyA: partyA.toLowerCase(),
          partyB: partyB.toLowerCase(),
          nonce: 0,
          ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          ethBalanceB: '0',
          tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          tokenBalanceB: '0'
        }
      ])
      stubHub.get(`/ledgerchannel/${channelId2}/vcinitialstates`).reply(200, [
        {
          channelId: threadId1, // eth + token thread
          partyA: partyA.toLowerCase(),
          partyB: partyB.toLowerCase(),
          nonce: 0,
          ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          ethBalanceB: '0',
          tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          tokenBalanceB: '0'
        },
        {
          channelId: threadId2, // eth only thread
          partyA: partyC.toLowerCase(),
          partyB: partyB.toLowerCase(),
          nonce: 0,
          ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          ethBalanceB: '0',
          tokenBalanceA: '0',
          tokenBalanceB: '0'
        },
        {
          channelId: threadId3, // token only thread
          partyA: partyD.toLowerCase(),
          partyB: partyB.toLowerCase(),
          nonce: 0,
          ethBalanceA: '0',
          ethBalanceB: '0',
          tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          tokenBalanceB: '0'
        }
      ])
      stubHub.get(`/ledgerchannel/${channelId3}/vcinitialstates`).reply(200, [
        {
          channelId: threadId2,
          partyA: partyC.toLowerCase(),
          partyB: partyB.toLowerCase(),
          nonce: 0,
          ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          ethBalanceB: '0',
          tokenBalanceA: '0',
          tokenBalanceB: '0'
        }
      ])
      stubHub.get(`/ledgerchannel/${channelId4}/vcinitialstates`).reply(200, [
        {
          channelId: threadId3,
          partyA: partyD.toLowerCase(),
          partyB: partyB.toLowerCase(),
          nonce: 0,
          ethBalanceA: '0',
          ethBalanceB: '0',
          tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          tokenBalanceB: '0'
        }
      ])

      // channel 1 - ETH/TOKEN (viewer)
      stubHub.get(`/ledgerchannel/${channelId1}`).reply(200, {
        channelId: channelId1,
        partyA: partyA.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('4', 'ether').toString(),
        ethBalanceI: '0',
        tokenBalanceA: Web3.utils.toWei('4', 'ether').toString(),
        tokenBalanceI: '0',
        nonce: 1,
        openVcs: 1,
        vcRootHash: Connext.generateThreadRootHash({
          threadInitialStates: [
            {
              channelId: threadId1,
              partyA: partyA.toLowerCase(),
              partyB: partyB.toLowerCase(),
              nonce: 0,
              ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
              ethBalanceB: '0',
              tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
              tokenBalanceB: '0'
            }
          ]
        })
      })

      // channel 2 - receiver
      stubHub.get(`/ledgerchannel/${channelId2}`).reply(200, {
        channelId: channelId2,
        partyA: partyB.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: '0',
        ethBalanceI: Web3.utils.toWei('5', 'ether').toString(),
        tokenBalanceA: '0',
        tokenBalanceI: Web3.utils.toWei('5', 'ether').toString(),
        nonce: 3,
        openVcs: 3,
        vcRootHash: Connext.generateThreadRootHash({
          threadInitialStates: [
            {
              channelId: threadId1, // eth + token thread
              partyA: partyA.toLowerCase(),
              partyB: partyB.toLowerCase(),
              nonce: 0,
              ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
              ethBalanceB: '0',
              tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
              tokenBalanceB: '0'
            },
            {
              channelId: threadId2, // eth only thread
              partyA: partyC.toLowerCase(),
              partyB: partyB.toLowerCase(),
              nonce: 0,
              ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
              ethBalanceB: '0',
              tokenBalanceA: '0',
              tokenBalanceB: '0'
            },
            {
              channelId: threadId3, // token only thread
              partyA: partyD.toLowerCase(),
              partyB: partyB.toLowerCase(),
              nonce: 0,
              ethBalanceA: '0',
              ethBalanceB: '0',
              tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
              tokenBalanceB: '0'
            }
          ]
        })
      })

      // channel 3 - ETH (viewer)
      stubHub.get(`/ledgerchannel/${channelId3}`).reply(200, {
        channelId: channelId3,
        partyA: partyC.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('4', 'ether').toString(),
        ethBalanceI: '0',
        tokenBalanceA: '0',
        tokenBalanceI: '0',
        nonce: 1,
        openVcs: 1,
        vcRootHash: Connext.generateThreadRootHash({
          threadInitialStates: [
            {
              channelId: threadId2,
              partyA: partyC.toLowerCase(),
              partyB: partyB.toLowerCase(),
              nonce: 0,
              ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
              ethBalanceB: '0',
              tokenBalanceA: '0',
              tokenBalanceB: '0'
            }
          ]
        })
      })

      // channel 4 - TOKEN (viewer)
      stubHub.get(`/ledgerchannel/${channelId4}`).reply(200, {
        channelId: channelId4,
        partyA: partyD.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: '0',
        ethBalanceI: '0',
        tokenBalanceA: Web3.utils.toWei('4', 'ether').toString(),
        tokenBalanceI: '0',
        nonce: 1,
        openVcs: 1,
        vcRootHash: Connext.generateThreadRootHash({
          threadInitialStates: [
            {
              channelId: threadId3,
              partyA: partyA.toLowerCase(),
              partyB: partyB.toLowerCase(),
              nonce: 0,
              ethBalanceA: '0',
              ethBalanceB: '0',
              tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
              tokenBalanceB: '0'
            }
          ]
        })
      })
      break

    case 'OPEN_LC_NO_VC':
      // add initial states endpoints
      stubHub.get(`/ledgerchannel/${channelId1}/vcinitialstates`).reply(200, [])
      stubHub.get(`/ledgerchannel/${channelId2}/vcinitialstates`).reply(200, [])
      stubHub.get(`/ledgerchannel/${channelId3}/vcinitialstates`).reply(200, [])
      stubHub.get(`/ledgerchannel/${channelId4}/vcinitialstates`).reply(200, [])

      // channel 1 - ETH/TOKEN (viewer)
      stubHub.get(`/ledgerchannel/${channelId1}`).reply(200, {
        channelId: channelId1,
        partyA: partyA.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('5', 'ether').toString(),
        ethBalanceI: '0',
        tokenBalanceA: Web3.utils.toWei('5', 'ether').toString(),
        tokenBalanceI: '0',
        nonce: 0,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      })

      // channel 2 - receiver
      stubHub.get(`/ledgerchannel/${channelId2}`).reply(200, {
        channelId: channelId2,
        partyA: partyB.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: '0',
        ethBalanceI: Web3.utils.toWei('5', 'ether').toString(),
        tokenBalanceA: '0',
        tokenBalanceI: Web3.utils.toWei('5', 'ether').toString(),
        nonce: 0,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      })

      // channel 3 - ETH (viewer)
      stubHub.get(`/ledgerchannel/${channelId3}`).reply(200, {
        channelId: channelId3,
        partyA: partyC.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('5', 'ether').toString(),
        ethBalanceI: '0',
        tokenBalanceA: '0',
        tokenBalanceI: '0',
        nonce: 0,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      })

      // channel 4 - TOKEN (viewer)
      stubHub.get(`/ledgerchannel/${channelId4}`).reply(200, {
        channelId: channelId4,
        partyA: partyD.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: '0',
        ethBalanceI: '0',
        tokenBalanceA: Web3.utils.toWei('5', 'ether').toString(),
        tokenBalanceI: '0',
        nonce: 0,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      })
      break

    case 'OPEN_LC_CLOSED_VC':
      // channel 1 - ETH/TOKEN (viewer)
      stubHub.get(`/ledgerchannel/${channelId1}`).reply(200, {
        channelId: channelId1,
        partyA: partyA.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('4.9', 'ether').toString(),
        ethBalanceI: Web3.utils.toWei('0.1', 'ether').toString(),
        tokenBalanceA: Web3.utils.toWei('4.9', 'ether').toString(),
        tokenBalanceI: Web3.utils.toWei('0.1', 'ether').toString(),
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      })

      // channel 2 - receiver
      stubHub.get(`/ledgerchannel/${channelId2}`).reply(200, {
        channelId: channelId2,
        partyA: partyB.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('0.2', 'ether').toString(),
        ethBalanceI: '0',
        tokenBalanceA: Web3.utils.toWei('0.2', 'ether').toString(),
        tokenBalanceI: '0',
        nonce: 6, // open thread 1-3, close thread 1-3
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      })

      // channel 3 - ETH (viewer)
      stubHub.get(`/ledgerchannel/${channelId3}`).reply(200, {
        channelId: channelId3,
        partyA: partyC.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: Web3.utils.toWei('4.9', 'ether').toString(),
        ethBalanceI: Web3.utils.toWei('0.1', 'ether').toString(),
        tokenBalanceA: '0',
        tokenBalanceI: '0',
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      })

      // channel 4 - TOKEN (viewer)
      stubHub.get(`/ledgerchannel/${channelId4}`).reply(200, {
        channelId: channelId4,
        partyA: partyD.toLowerCase(),
        partyI: ingridAddress.toLowerCase(),
        state: 'LCS_OPENED',
        ethBalanceA: '0',
        ethBalanceI: '0',
        tokenBalanceA: Web3.utils.toWei('4.9', 'ether').toString(),
        tokenBalanceI: Web3.utils.toWei('0.1', 'ether').toString(),
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] })
      })
      break

    default:
      break
  }

  // maybe we wont need this..
  switch (threadType) {
    case 'NOT_UPDATED':
      // get thread 1 by ID (nonce = 0)
      // ETH_TOKEN vc
      stubHub.get(`/virtualchannel/${threadId1}`).reply(200, {
        channelId: threadId1,
        partyA: partyA.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
        ethBalanceB: '0',
        tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
        tokenBalanceB: '0',
        nonce: 0
      })

      // ETH VC
      stubHub.get(`/virtualchannel/${threadId2}`).reply(200, {
        channelId: threadId2,
        partyA: partyC.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
        ethBalanceB: '0',
        tokenBalanceA: '0',
        tokenBalanceB: '0',
        nonce: 0
      })

      // TOKEN VC
      stubHub.get(`/virtualchannel/${threadId3}`).reply(200, {
        channelId: threadId3,
        partyA: partyD.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        ethBalanceA: '0',
        ethBalanceB: '0',
        tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
        tokenBalanceB: '0',
        nonce: 0
      })

      // add get latest thread state endpoint
      // ETH/TOKEN
      let sigA = await web3.eth.sign(
        Connext.createThreadStateUpdateFingerprint({
          channelId: threadId1,
          partyA,
          partyB,
          ethBalanceA: Web3.utils.toWei('1', 'ether'),
          ethBalanceB: Web3.utils.toBN('0'),
          tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          tokenBalanceB: Web3.utils.toBN('0'),
          nonce: 0
        }),
        partyA
      )
      stubHub.get(`/virtualchannel/${threadId1}/update/latest`).reply(200, {
        ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
        ethBalanceB: '0',
        tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
        tokenBalanceB: '0',
        nonce: 0,
        sigA
      })

      // ETH
      sigA = await web3.eth.sign(
        Connext.createThreadStateUpdateFingerprint({
          channelId: threadId2,
          partyA: partyC,
          partyB,
          ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          ethBalanceB: Web3.utils.toBN('0'),
          tokenBalanceA: Web3.utils.toBN('0'),
          tokenBalanceB: Web3.utils.toBN('0'),
          nonce: 0
        }),
        partyC
      )
      stubHub.get(`/virtualchannel/${threadId2}/update/latest`).reply(200, {
        ethBalanceA: Web3.utils.toWei('1', 'ether').toString(),
        ethBalanceB: '0',
        tokenBalanceA: '0',
        tokenBalanceB: '0',
        nonce: 0,
        sigA
      })

      // TOKEN
      sigA = await web3.eth.sign(
        Connext.createThreadStateUpdateFingerprint({
          channelId: threadId3,
          partyA: partyD,
          partyB,
          ethBalanceA: Web3.utils.toBN('0'),
          ethBalanceB: Web3.utils.toBN('0'),
          tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
          tokenBalanceB: Web3.utils.toBN('0'),
          nonce: 0
        }),
        partyD
      )
      stubHub.get(`/virtualchannel/${threadId3}/update/latest`).reply(200, {
        ethBalanceA: '0',
        ethBalanceB: '0',
        tokenBalanceA: Web3.utils.toWei('1', 'ether').toString(),
        tokenBalanceB: '0',
        nonce: 0,
        sigA
      })

      break

    case 'UPDATED':
      // ETH_TOKEN vc
      stubHub.get(`/virtualchannel/${threadId1}`).reply(200, {
        channelId: threadId1,
        partyA: partyA.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        ethBalanceA: Web3.utils.toWei('0.9', 'ether').toString(),
        ethBalanceB: Web3.utils.toWei('0.1', 'ether').toString(),
        tokenBalanceA: Web3.utils.toWei('0.9', 'ether').toString(),
        tokenBalanceB: Web3.utils.toWei('0.1', 'ether').toString(),
        nonce: 1
      })

      // ETH VC
      stubHub.get(`/virtualchannel/${threadId2}`).reply(200, {
        channelId: threadId2,
        partyA: partyC.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        ethBalanceA: Web3.utils.toWei('0.9', 'ether').toString(),
        ethBalanceB: Web3.utils.toWei('0.1', 'ether').toString(),
        tokenBalanceA: '0',
        tokenBalanceB: '0',
        nonce: 1
      })

      // TOKEN VC
      stubHub.get(`/virtualchannel/${threadId3}`).reply(200, {
        channelId: threadId3,
        partyA: partyD.toLowerCase(),
        partyB: partyB.toLowerCase(),
        state: 'VCS_OPENING',
        ethBalanceA: '0',
        ethBalanceB: '0',
        tokenBalanceA: Web3.utils.toWei('0.9', 'ether').toString(),
        tokenBalanceB: Web3.utils.toWei('0.1', 'ether').toString(),
        nonce: 1
      })

      // add get latest thread state endpoint
      // ETH/TOKEN
      sigA = await web3.eth.sign(
        Connext.createThreadStateUpdateFingerprint({
          channelId: threadId1,
          partyA: partyA,
          partyB,
          ethBalanceA: Web3.utils.toWei('0.9', 'ether'),
          ethBalanceB: Web3.utils.toWei('0.1', 'ether'),
          tokenBalanceA: Web3.utils.toWei('0.9', 'ether'),
          tokenBalanceB: Web3.utils.toWei('0.1', 'ether'),
          nonce: 1
        }),
        partyA
      )
      stubHub.get(`/virtualchannel/${threadId1}/update/latest`).reply(200, {
        ethBalanceA: Web3.utils.toWei('0.9', 'ether').toString(),
        ethBalanceB: Web3.utils.toWei('0.1', 'ether').toString(),
        tokenBalanceA: Web3.utils.toWei('0.9', 'ether').toString(),
        tokenBalanceB: Web3.utils.toWei('0.1', 'ether').toString(),
        nonce: 1,
        sigA
      })

      // ETH
      sigA = await web3.eth.sign(
        Connext.createThreadStateUpdateFingerprint({
          channelId: threadId2,
          partyA: partyC,
          partyB,
          ethBalanceA: Web3.utils.toWei('0.9', 'ether'),
          ethBalanceB: Web3.utils.toWei('0.1', 'ether'),
          tokenBalanceA: Web3.utils.toBN('0'),
          tokenBalanceB: Web3.utils.toBN('0'),
          nonce: 1
        }),
        partyC
      )
      stubHub.get(`/virtualchannel/${threadId2}/update/latest`).reply(200, {
        ethBalanceA: Web3.utils.toWei('0.9', 'ether').toString(),
        ethBalanceB: Web3.utils.toWei('0.1', 'ether').toString(),
        tokenBalanceA: '0',
        tokenBalanceB: '0',
        nonce: 1,
        sigA
      })

      // TOKEN
      sigA = await web3.eth.sign(
        Connext.createThreadStateUpdateFingerprint({
          channelId: threadId3,
          partyA: partyD,
          partyB,
          ethBalanceA: Web3.utils.toBN('0'),
          ethBalanceB: Web3.utils.toBN('0'),
          tokenBalanceA: Web3.utils.toWei('0.9', 'ether'),
          tokenBalanceB: Web3.utils.toWei('0.1', 'ether'),
          nonce: 1
        }),
        partyD
      )
      stubHub.get(`/virtualchannel/${threadId3}/update/latest`).reply(200, {
        ethBalanceA: '0',
        ethBalanceB: '0',
        tokenBalanceA: Web3.utils.toWei('0.9', 'ether').toString(),
        tokenBalanceB: Web3.utils.toWei('0.1', 'ether').toString(),
        nonce: 1,
        sigA
      })

      // post to close VC endpoint
      let sigParams = {
        channelId: channelId1,
        isClose: false,
        nonce: 2,
        openVcs: 0,
        vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
        partyA: partyA.toLowerCase(),
        partyI: ingridAddress,
        ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
        tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
        tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
      }
      const sigItoAThread1 = await web3.eth.sign(
        Connext.createChannelStateUpdateFingerprint(sigParams),
        ingridAddress
      )
      // update for eth only thread
      sigParams.partyA = partyC.toLowerCase()
      sigParams.channelId = channelId3
      sigParams.tokenBalanceA = sigParams.tokenBalanceI = Web3.utils.toBN('0')
      const sigItoAThread2 = await web3.eth.sign(
        Connext.createChannelStateUpdateFingerprint(sigParams),
        ingridAddress
      )
      // update for token only thread
      sigParams.partyA = partyD.toLowerCase()
      sigParams.channelId = channelId4
      sigParams.tokenBalanceA = Web3.utils.toBN(
        Web3.utils.toWei('4.9', 'ether')
      )
      sigParams.tokenBalanceI = Web3.utils.toBN(
        Web3.utils.toWei('0.1', 'ether')
      )
      sigParams.ethBalanceA = sigParams.ethBalanceI = Web3.utils.toBN('0')
      const sigItoAThread3 = await web3.eth.sign(
        Connext.createChannelStateUpdateFingerprint(sigParams),
        ingridAddress
      )
      stubHub
        .post(`/virtualchannel/${threadId1}/close`)
        .reply(200, { sigI: sigItoAThread1 })
      stubHub
        .post(`/virtualchannel/${threadId2}/close`)
        .reply(200, { sigI: sigItoAThread2 })
      stubHub
        .post(`/virtualchannel/${threadId3}/close`)
        .reply(200, { sigI: sigItoAThread3 })

      break

    default:
      break
  }

  // post to payments endpoint
  // 1 payment, return array of 1
  stubHub
    .post(`/payments/`, body => {
      return body.payments.length === 1
    })
    .reply(200, [
      {
        id: 2,
        balanceA: '20000',
        balanceB: '6000',
        nonce: 2,
        sigA: '0x6e4f3d1782440461d72436afb5f087b74db3d034a9623cc0c10e0819dba7d2eb45818f11d2ceaf4e647eae4e946115bcb22cb99d5b1c6e134efbbc7629898e8f01',
        sigB: null
      }
    ])
  // 1 payment, return array of 2
  stubHub
    .post(`/payments/`, body => {
      return body.payments.length === 2
    })
    .reply(200, [
      {
        id: 2,
        balanceA: '20000',
        balanceB: '6000',
        nonce: 2,
        sigA: '0x6e4f3d1782440461d72436afb5f087b74db3d034a9623cc0c10e0819dba7d2eb45818f11d2ceaf4e647eae4e946115bcb22cb99d5b1c6e134efbbc7629898e8f01',
        sigB: null
      },
      {
        id: 3,
        balanceA: '20000',
        balanceB: '6000',
        nonce: 2,
        sigA: '0x6e4f3d1782440461d72436afb5f087b74db3d034a9623cc0c10e0819dba7d2eb45818f11d2ceaf4e647eae4e946115bcb22cb99d5b1c6e134efbbc7629898e8f01',
        sigB: null
      }
    ])

  // add post to create vc endpoint
  stubHub
    .post(`/virtualchannel/`, body => {
      return body.channelId === threadId1
    })
    .reply(200, {
      channelId: threadId1
    })
  stubHub
    .post(`/virtualchannel/`, body => {
      return body.channelId === threadId2
    })
    .reply(200, {
      channelId: threadId2
    })
  stubHub
    .post(`/virtualchannel/`, body => {
      return body.channelId === threadId3
    })
    .reply(200, {
      channelId: threadId3
    })

  // add post to fastclose lc endpoint
  // ETH/TOKEN channel (viewer)
  // generate hash
  let hash = Connext.createChannelStateUpdateFingerprint({
    channelId: channelId1,
    partyA,
    partyI: ingridAddress,
    isClose: true,
    nonce: 3,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
  })
  let sigAFinal = await web3.eth.sign(hash, partyA)
  let sigIAFinal = await web3.eth.sign(hash, ingridAddress)
  stubHub.post(`/ledgerchannel/${channelId1}/fastclose`).reply(200, {
    isClose: true,
    nonce: 3,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')).toString(),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')).toString(),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')).toString(),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')).toString(),
    sigA: sigAFinal,
    sigI: sigIAFinal
  })

  // ETH/TOKEN channel (receiver)
  hash = Connext.createChannelStateUpdateFingerprint({
    channelId: channelId2,
    partyA: partyB,
    partyI: ingridAddress,
    isClose: true,
    nonce: 7,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('0.2', 'ether')),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('0.2', 'ether')),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
  })
  let sigBFinal = await web3.eth.sign(hash, partyB)
  let sigIBFinal = await web3.eth.sign(hash, ingridAddress)
  stubHub.post(`/ledgerchannel/${channelId2}/fastclose`).reply(200, {
    isClose: true,
    nonce: 7,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('0.2', 'ether')).toString(),
    ethBalanceI: '0',
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('0.2', 'ether')).toString(),
    tokenBalanceI: '0',
    sigA: sigBFinal,
    sigI: sigIBFinal
  })

  // ETH channel (viewer)
  hash = Connext.createChannelStateUpdateFingerprint({
    channelId: channelId3,
    partyA: partyC,
    partyI: ingridAddress,
    isClose: true,
    nonce: 3,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
  })
  let sigCFinal = await web3.eth.sign(hash, partyC)
  let sigICFinal = await web3.eth.sign(hash, ingridAddress)
  stubHub.post(`/ledgerchannel/${channelId3}/fastclose`).reply(200, {
    isClose: true,
    nonce: 3,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')).toString(),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')).toString(),
    tokenBalanceA: '0',
    tokenBalanceI: '0',
    sigA: sigCFinal,
    sigI: sigICFinal
  })

  // TOKEN channel (viewer)
  hash = Connext.createChannelStateUpdateFingerprint({
    channelId: channelId4,
    partyA: partyD,
    partyI: ingridAddress,
    isClose: true,
    nonce: 3,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
  })
  let sigDFinal = await web3.eth.sign(hash, partyD)
  let sigIDFinal = await web3.eth.sign(hash, ingridAddress)
  stubHub.post(`/ledgerchannel/${channelId4}/fastclose`).reply(200, {
    isClose: true,
    nonce: 3,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: '0',
    ethBalanceI: '0',
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')).toString(),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')).toString(),
    sigA: sigDFinal,
    sigI: sigIDFinal
  })

  // add get latest i-signed channel state endpoint
  // ETH/TOKEN (viewer)
  hash = Connext.createChannelStateUpdateFingerprint({
    channelId: channelId1,
    partyA,
    partyI: ingridAddress,
    isClose: false,
    nonce: 2,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether'))
  })
  sigAFinal = await web3.eth.sign(hash, partyA)
  sigIAFinal = await web3.eth.sign(hash, ingridAddress)
  stubHub
    .get(`/ledgerchannel/${channelId1}/update/latest?sig[]=sigI`)
    .reply(200, {
      isClose: false,
      partyA,
      partyI: ingridAddress,
      nonce: 2,
      openVcs: 0,
      vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
      ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')).toString(),
      ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')).toString(),
      tokenBalanceA: Web3.utils
        .toBN(Web3.utils.toWei('4.9', 'ether'))
        .toString(),
      tokenBalanceI: Web3.utils
        .toBN(Web3.utils.toWei('0.1', 'ether'))
        .toString(),
      sigI: sigIAFinal,
      sigA: sigAFinal
    })

  // ETH/TOKEN (recipient)
  hash = Connext.createChannelStateUpdateFingerprint({
    channelId: channelId2,
    partyA: partyB,
    partyI: ingridAddress,
    isClose: false,
    nonce: 6,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('0.2', 'ether')),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('0.2', 'ether')),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
  })
  sigBFinal = await web3.eth.sign(hash, partyB)
  sigIBFinal = await web3.eth.sign(hash, ingridAddress)
  stubHub
    .get(`/ledgerchannel/${channelId2}/update/latest?sig[]=sigI`)
    .reply(200, {
      isClose: false,
      partyA: partyB,
      partyI: ingridAddress,
      nonce: 6,
      openVcs: 0,
      vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
      ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('0.2', 'ether')).toString(),
      ethBalanceI: '0',
      tokenBalanceA: Web3.utils
        .toBN(Web3.utils.toWei('0.2', 'ether'))
        .toString(),
      tokenBalanceI: '0',
      sigI: sigIBFinal,
      sigA: sigBFinal
    })

  // ETH (viewer)
  hash = Connext.createChannelStateUpdateFingerprint({
    channelId: channelId3,
    partyA: partyC,
    partyI: ingridAddress,
    isClose: false,
    nonce: 2,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
  })
  sigCFinal = await web3.eth.sign(hash, partyC)
  sigICFinal = await web3.eth.sign(hash, ingridAddress)
  stubHub
    .get(`/ledgerchannel/${channelId3}/update/latest?sig[]=sigI`)
    .reply(200, {
      isClose: false,
      partyA: partyC,
      partyI: ingridAddress,
      nonce: 2,
      openVcs: 0,
      vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
      ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')).toString(),
      ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')).toString(),
      tokenBalanceA: '0',
      tokenBalanceI: '0',
      sigI: sigICFinal,
      sigA: sigCFinal
    })

  // TOKEN (viewer)
  hash = Connext.createChannelStateUpdateFingerprint({
    channelId: channelId4,
    partyA: partyD,
    partyI: ingridAddress,
    isClose: false,
    nonce: 2,
    openVcs: 0,
    vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
    tokenBalanceA: Web3.utils.toBN(Web3.utils.toWei('4.9', 'ether')),
    tokenBalanceI: Web3.utils.toBN(Web3.utils.toWei('0.1', 'ether')),
    ethBalanceA: Web3.utils.toBN(Web3.utils.toWei('0', 'ether')),
    ethBalanceI: Web3.utils.toBN(Web3.utils.toWei('0', 'ether'))
  })
  sigDFinal = await web3.eth.sign(hash, partyD)
  sigIDFinal = await web3.eth.sign(hash, ingridAddress)
  stubHub
    .get(`/ledgerchannel/${channelId4}/update/latest?sig[]=sigI`)
    .reply(200, {
      isClose: false,
      partyA: partyD,
      partyI: ingridAddress,
      nonce: 2,
      openVcs: 0,
      vcRootHash: Connext.generateThreadRootHash({ threadInitialStates: [] }),
      tokenBalanceA: Web3.utils
        .toBN(Web3.utils.toWei('4.9', 'ether'))
        .toString(),
      tokenBalanceI: Web3.utils
        .toBN(Web3.utils.toWei('0.1', 'ether'))
        .toString(),
      ethBalanceA: '0',
      ethBalanceI: '0',
      sigI: sigIDFinal,
      sigA: sigDFinal
    })

  // add request sign deposits endpoint
  stubHub
    .post(`/ledgerchannel/${channelId1}/deposit`)
    .reply(200, {})
  stubHub
    .post(`/ledgerchannel/${channelId2}/deposit`)
    .reply(200, {})
  stubHub
    .post(`/ledgerchannel/${channelId3}/deposit`)
    .reply(200, {})
  stubHub
    .post(`/ledgerchannel/${channelId4}/deposit`)
    .reply(200, {})
  return stubHub
}
