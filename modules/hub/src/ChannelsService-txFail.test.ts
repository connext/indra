import { toWeiBigNum } from "./util/bigNumber";
import { getTestRegistry, assert } from "./testing";
import Web3 = require('web3')
import { mkHash, mkSig, assertChannelStateEqual } from "./testing/stateUtils";
import { MockExchangeRateDao, MockGasEstimateDao, MockSignerService } from "./testing/mocks";
import ChannelsService from "./ChannelsService";
import { StateGenerator } from "./vendor/connext/StateGenerator";
import { channelUpdateFactory } from "./testing/factories";
import { DepositArgsBigNumber, UpdateRequest, convertChannelState, convertDeposit, DepositArgs } from "./vendor/connext/types";

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
                  return cb('This is a fake error')
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
                  return cb('This is a fake error')
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

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should invalidate a failing hub authorized update', async () => {
    let channel = await channelUpdateFactory(registry)
    await service.doCollateralizeIfNecessary(channel.user)
    let sync = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    let latest = sync.pop()
    assert.equal((latest.update as UpdateRequest).reason, 'ProposePendingDeposit')

    await service.doUpdates(channel.user, [{
      reason: 'ProposePendingDeposit',
      args: convertDeposit('bignumber', (latest.update as UpdateRequest).args as DepositArgs),
      txCount: channel.state.txCountGlobal + 1,
      sigUser: mkSig('0xc')
    }])

    await new Promise(res => setTimeout(() => res(), 3000))

    sync = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    latest = sync.pop()
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
  }).timeout(5000)
})