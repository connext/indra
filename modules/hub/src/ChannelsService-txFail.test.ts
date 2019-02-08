import { toWeiBigNum } from "./util/bigNumber";
import { getTestRegistry, assert } from "./testing";
import Web3 = require('web3')
import { mkHash, mkSig, assertChannelStateEqual } from "./testing/stateUtils";
import { MockExchangeRateDao, MockGasEstimateDao, MockSignerService } from "./testing/mocks";
import ChannelsService from "./ChannelsService";
import { StateGenerator } from "./vendor/connext/StateGenerator";
import { channelUpdateFactory } from "./testing/factories";
import { DepositArgsBigNumber, UpdateRequest, convertChannelState, convertDeposit, DepositArgs } from "./vendor/connext/types";
import { sleep } from "./util";
import ChannelsDao from "./dao/ChannelsDao";
import DBEngine, { SQL } from "./DBEngine";

function web3ContractMock() {
  this.methods = {
    hubAuthorizedUpdate: () => {
      return {
        send: async () => {
          console.log(`Called mocked contract function hubAuthorizedUpdate`)
          return true
        },
        encodeABI: async () => {
          console.log(`Called mocked contract function hubAuthorizedUpdate`)
          return true
        },
      }
    },
  }
}

describe('ChannelsService-txFail', () => {
  const registry = getTestRegistry({
    Web3: {
      ...Web3,
      eth: {
        Contract: web3ContractMock,
        sign: async () => {
          return
        },
        getTransactionCount: async () => {
          return 1
        },
        estimateGas: async () => {
          return 1000
        },
        signTransaction: async () => {
          return {
            tx: {
              hash: mkHash('0xaaa'),
              r: mkHash('0xabc'),
              s: mkHash('0xdef'),
              v: '0x27',
            },
          }
        },
        sendSignedTransaction: () => {
          console.log(`Called mocked web3 function sendSignedTransaction`)
          return {
            on: (input, cb) => {
              switch (input) {
                case 'error':
                  return cb('nonce too low')
              }
            },
          }
        },
        sendTransaction: () => {
          console.log(`Called mocked web3 function sendTransaction`)
          return {
            on: (input, cb) => {
              switch (input) {
                case 'error':
                  return cb('nonce too low')
              }
            },
          }
        },
      },
    },
    ExchangeRateDao: new MockExchangeRateDao(),
    GasEstimateDao: new MockGasEstimateDao(),
    SignerService: new MockSignerService()
  })

  const service: ChannelsService = registry.get('ChannelsService')
  const stateGenerator: StateGenerator = registry.get('StateGenerator')
  const dao: ChannelsDao = registry.get('ChannelsDao')
  const db: DBEngine = registry.get('DBEngine')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should invalidate a failing hub authorized update', async () => {
    let channel = await channelUpdateFactory(registry)
    await service.doCollateralizeIfNecessary(channel.user)
    let { updates: sync } = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    let latest = sync.pop()
    assert.equal((latest.update as UpdateRequest).reason, 'ProposePendingDeposit')

    await service.doUpdates(channel.user, [{
      reason: 'ProposePendingDeposit',
      args: convertDeposit('bignumber', (latest.update as UpdateRequest).args as DepositArgs),
      txCount: channel.state.txCountGlobal + 1,
      sigUser: mkSig('0xc')
    }])

    // need to sleep here to let the async process fail
    sleep(50)

    let { updates: sync2 } = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    latest = sync2.pop()
    assert.equal((latest.update as UpdateRequest).reason, 'Invalidation')
    const generated = stateGenerator.invalidation(
      convertChannelState('bn', channel.state), 
      {
        lastInvalidTxCount: channel.state.txCountGlobal + 1,
        previousValidTxCount: channel.state.txCountGlobal,
        reason: 'CU_INVALID_ERROR'
      }
    )
    assertChannelStateEqual(generated, {
      pendingDepositToken: [0, 0],
      pendingDepositWei: [0, 0],
      pendingWithdrawalToken: [0, 0],
      pendingWithdrawalWei: [0, 0],
    })
  })

  // TODO: make this work again
  // it('should move a disputed channel back to open if tx fails', async () => {
  //   const channel = await channelUpdateFactory(registry)
  //   await service.startUnilateralExit(channel.user, 'this is a test')
  //   // need to sleep here to let the async process fail
  //   await sleep(20)

  //   const { status } = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
  //   assert.equal(status, 'CS_OPEN')
  // })
})
