import { PostgresChannelsDao } from './dao/ChannelsDao'
import ChannelsService, { CHANNEL_BOOTY_LIMIT } from './ChannelsService'
import { getTestRegistry, assert } from './testing'
import {
  MockExchangeRateDao,
  MockGasEstimateDao,
  mockRate,
  MockSignerService,
  fakeSig
} from './testing/mocks'
import {
  getChannelState,
  assertChannelStateEqual,
  mkAddress,
  mkSig,
  getThreadState,
  mkHash,
} from './testing/stateUtils'
import { Big, toWeiBigNum, toWeiString } from './util/bigNumber'
import {
  ChannelState,
  ChannelUpdateReason,
  convertChannelState,
  UpdateRequest,
  DepositArgs,
  convertDeposit,
  convertExchange,
} from './vendor/connext/types'
import Web3 = require('web3')
import ThreadsDao from './dao/ThreadsDao'
import {
  channelUpdateFactory,
  tokenVal,
  channelAndThreadFactory,
} from './testing/factories'
import { StateGenerator } from './vendor/connext/StateGenerator'

// TODO: extract web3

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

const contract = mkAddress('0xCCC')

describe('ChannelsService', () => {
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
                case 'transactionHash':
                  return cb(mkHash('0xbeef'))
                case 'error':
                  return cb(null)
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

  const channelsDao: PostgresChannelsDao = registry.get('ChannelsDao')
  const service: ChannelsService = registry.get('ChannelsService')
  const threadsDao: ThreadsDao = registry.get('ThreadsDao')
  const stateGenerator: StateGenerator = registry.get('StateGenerator')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should create an update for a user deposit request when channel does not exist', async () => {
    const weiDeposit = toWeiBigNum(0.1)
    const user = mkAddress('0xa')

    const timeout = Math.floor(Date.now() / 1000) + 5 * 60
    await service.doRequestDeposit(user, weiDeposit, Big(0))
    const [updateRequest] = await service.getChannelAndThreadUpdatesForSync(
      user,
      0,
      0,
    )

    const pendingDepositTokenHub = weiDeposit.mul(mockRate)

    assert.equal(
      (updateRequest.update as UpdateRequest).reason,
      'ProposePendingDeposit' as ChannelUpdateReason,
    )
    const generatedState = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', getChannelState('initial', { user })),
      convertDeposit('bn', (updateRequest.update as UpdateRequest)
        .args as DepositArgs),
    )
    assert.equal(generatedState.timeout >= timeout, true)
    assertChannelStateEqual(
      {
        ...generatedState,
        sigHub: (updateRequest.update as UpdateRequest).sigHub,
      },
      {
        sigHub: fakeSig,
        pendingDepositTokenHub: pendingDepositTokenHub.toFixed(),
        pendingDepositWeiUser: weiDeposit.toFixed(),
        txCountChain: 1,
        txCountGlobal: 1,
      },
    )
  })

  it('should create a user deposit request when channel has enough booty to collateralize', async () => {
    const chan = await channelUpdateFactory(registry, {
      contractAddress: contract,
      balanceWei: ['0', '0'],
      balanceToken: [toWeiString(33), '0'],
    })

    const weiDeposit = toWeiBigNum(0.02).toFixed()

    const timeout = Math.floor(Date.now() / 1000) + 5 * 60
    await service.doRequestDeposit(chan.state.user, Big(weiDeposit), Big(0))

    const syncUpdates = await service.getChannelAndThreadUpdatesForSync(
      chan.state.user,
      0,
      0,
    )
    const latestState = syncUpdates[syncUpdates.length - 1]

    assert.equal(
      (latestState.update as UpdateRequest).reason,
      'ProposePendingDeposit' as ChannelUpdateReason,
    )

    const generatedState = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', chan.state),
      convertDeposit('bn', (latestState.update as UpdateRequest)
        .args as DepositArgs),
    )
    assert.equal((generatedState as ChannelState).timeout >= timeout, true)
    assertChannelStateEqual(generatedState, {
      pendingDepositTokenHub: '0',
      pendingDepositWeiUser: weiDeposit,
    })
  })

  it('should create a user deposit request when user deposits more than booty limit', async () => {
    const weiDeposit = toWeiBigNum(1)

    const chan = await channelUpdateFactory(registry, {
      contractAddress: contract,
      balanceWei: ['0', '0'],
      balanceToken: [tokenVal(33), '0'],
    })

    const timeout = Math.floor(Date.now() / 1000) + 5 * 60
    await service.doRequestDeposit(chan.state.user, weiDeposit, Big(0))
    const syncUpdates = await service.getChannelAndThreadUpdatesForSync(
      chan.state.user,
      0,
      0,
    )
    const latestState = syncUpdates[syncUpdates.length - 1]

    assert.equal(
      (latestState.update as UpdateRequest).reason,
      'ProposePendingDeposit' as ChannelUpdateReason,
    )
    const pendingDepositTokenHub = CHANNEL_BOOTY_LIMIT.minus(
      chan.state.balanceTokenHub,
    )

    const generatedState = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', chan.state),
      convertDeposit('bn', (latestState.update as UpdateRequest)
        .args as DepositArgs),
    )
    assert.equal(generatedState.timeout >= timeout, true)
    assertChannelStateEqual(generatedState, {
      pendingDepositTokenHub: pendingDepositTokenHub.toFixed(),
      pendingDepositWeiUser: weiDeposit.toFixed(),
    })
  })

  it('should create a user deposit request when user deposits less than booty limit', async () => {
    const weiDeposit = toWeiBigNum('0.1')

    const chan = await channelUpdateFactory(registry, {
      contractAddress: contract,
      balanceWei: ['0', '0'],
      balanceToken: [toWeiString(1), '0'],
    })

    const timeout = Math.floor(Date.now() / 1000) + 5 * 60
    await service.doRequestDeposit(chan.state.user, weiDeposit, Big(0))
    const syncUpdates = await service.getChannelAndThreadUpdatesForSync(
      chan.state.user,
      0,
      0,
    )
    const latestState = syncUpdates[syncUpdates.length - 1]

    assert.equal(
      (latestState.update as UpdateRequest).reason,
      'ProposePendingDeposit' as ChannelUpdateReason,
    )
    const pendingDepositTokenHub = weiDeposit
      .mul(mockRate)
      .minus(toWeiString(1))

    const generatedState = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', chan.state),
      convertDeposit('bn', (latestState.update as UpdateRequest)
        .args as DepositArgs),
    )

    assert.equal(generatedState.timeout >= timeout, true)
    assertChannelStateEqual(generatedState, {
      pendingDepositTokenHub: pendingDepositTokenHub.toFixed(),
      pendingDepositWeiUser: weiDeposit.toFixed(),
    })
  })

  it('should exchange eth for booty in channel - happy case', async () => {
    const channel = await channelUpdateFactory(registry, {
      contractAddress: contract,
      balanceWeiHub: toWeiString(10),
      balanceWeiUser: toWeiString(0.5),
      balanceTokenUser: toWeiString(20),
    })

    const exchangeArgs = await service.doRequestExchange(
      channel.user,
      Big(0),
      toWeiBigNum(10),
    )
    const generated = stateGenerator.exchange(
      convertChannelState('bn', channel.state),
      convertExchange('bn', exchangeArgs),
    )
    const unsigned = await service.redisGetUnsignedState(channel.user)

    assertChannelStateEqual(generated, unsigned.state)

    const balanceWeiExchangeAmount = toWeiBigNum(10)
      .dividedBy(mockRate)
      .floor()

    assertChannelStateEqual(unsigned.state, {
      balanceWeiUser: Big(channel.state.balanceWeiUser)
        .plus(balanceWeiExchangeAmount)
        .toFixed(),
      balanceWeiHub: Big(channel.state.balanceWeiHub)
        .minus(balanceWeiExchangeAmount)
        .toFixed(),
      balanceTokenUser: toWeiString(10),
      balanceTokenHub: toWeiString(10),
    })
  })

  it('should onboard a performer by collateralizing their channel - happy case', async () => {
    const user = mkAddress('0xabc')

    const depositArgs = await service.doCollateralizeIfNecessary(user)
    const generated = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', getChannelState('initial', { user, recipient: user })),
      convertDeposit('bn', depositArgs),
    )
    const unsigned = await service.redisGetUnsignedState(user)
    assertChannelStateEqual(generated, unsigned.state)

    assertChannelStateEqual(unsigned.state, {
      pendingDepositTokenHub: toWeiString(50),
      txCountGlobal: 1,
      txCountChain: 1,
    })
  })

  it('should recollateralize a performer channel when they have threads open', async () => {
    const user1 = mkAddress('0xa')
    const user2 = mkAddress('0xb')
    const user3 = mkAddress('0xc')
    const user4 = mkAddress('0xd')
    const user5 = mkAddress('0xe')

    await channelAndThreadFactory(registry, user1)
    await channelAndThreadFactory(registry, user2)
    await channelAndThreadFactory(registry, user3)
    await channelAndThreadFactory(registry, user4)
    const threadUsers = await channelAndThreadFactory(registry, user5)

    const depositArgs = await service.doCollateralizeIfNecessary(
      threadUsers.performer.user,
      5,
    )
    const generated = stateGenerator.proposePendingDeposit(
      convertChannelState(
        'bn',
        threadUsers.performer.state,
      ),
      convertDeposit('bn', depositArgs),
    )
    const unsigned = await service.redisGetUnsignedState(threadUsers.performer.user)
    assertChannelStateEqual(generated, unsigned.state)

    assertChannelStateEqual(unsigned.state, {
      pendingDepositTokenHub: toWeiString(125),
      txCountGlobal: 2,
      txCountChain: 2,
    })
  })

  it('should onboard a performer with an onchain hubAuthorizedUpdate', async () => {
    const user = mkAddress('0xabc')
    const sigUser = mkSig('0xddd')

    const depositArgs = await service.doCollateralizeIfNecessary(user)
    const unsigned = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', getChannelState('initial', { user })),
      convertDeposit('bn', depositArgs),
    )

    await service.doUpdates(user, [
      {
        reason: 'ProposePendingDeposit',
        args: depositArgs,
        sigUser,
        txCount: unsigned.txCountGlobal,
      } as UpdateRequest,
    ])

    let syncUpdates = await service.getChannelAndThreadUpdatesForSync(
      user,
      0,
      0,
    )
    const proposePending = syncUpdates[syncUpdates.length - 1].update as UpdateRequest
    const generated = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', getChannelState('initial', { user })),
      convertDeposit('bn', proposePending.args as DepositArgs),
    )

    assert.equal(proposePending.reason, 'ProposePendingDeposit')
    assertChannelStateEqual(
      {
        ...generated,
        sigHub: proposePending.sigHub,
        sigUser: proposePending.sigUser,
      } as ChannelState,
      {
        pendingDepositTokenHub: toWeiString(50),
        sigHub: fakeSig,
        sigUser,
        txCount: [1, 1],
      },
    )
  })

  it('should verify an exchange', async () => {
    const sigUser = mkSig('0xa')

    const channel = await channelUpdateFactory(registry, {
      balanceWeiHub: toWeiString(0.5),
      balanceTokenUser: toWeiString(20),
    })

    const exchangeArgs = await service.doRequestExchange(
      channel.user,
      Big(0),
      toWeiBigNum(10),
    )
    const unsigned = stateGenerator.exchange(
      convertChannelState('bn', channel.state),
      convertExchange('bn', exchangeArgs),
    )

    await service.doUpdates(channel.user, [
      {
        reason: 'Exchange',
        args: exchangeArgs,
        sigUser,
        txCount: unsigned.txCountGlobal,
      } as UpdateRequest,
    ])

    const expectedExchangeAmountWei = toWeiBigNum(10)
      .div(mockRate)
      .floor()

    let syncUpdates = await service.getChannelAndThreadUpdatesForSync(
      channel.user,
      0,
      0,
    )
    let exchangeUpdate = syncUpdates[syncUpdates.length - 1]
      .update as UpdateRequest

    const generated = stateGenerator.exchange(
      convertChannelState('bn', channel.state),
      convertExchange('bn', exchangeArgs),
    )

    assert.equal(exchangeUpdate.reason, 'Exchange')
    assertChannelStateEqual(generated, {
      balanceWeiHub: Big(channel.state.balanceWeiHub).minus(
        expectedExchangeAmountWei,
      ),
      balanceWeiUser: Big(channel.state.balanceWeiUser).plus(
        expectedExchangeAmountWei,
      ),
      balanceTokenHub: toWeiString(10),
      balanceTokenUser: toWeiString(10),
      txCount: [2, 1],
    })
  })

  async function runWithdrawalTest(
    initial: Partial<ChannelState>,
    expected: Partial<ChannelState>,
  ) { }

  it('withdrawal where hub withdraws booty', async () => {
    const channel = await channelUpdateFactory(registry, {
      balanceTokenHub: toWeiString(10),
      balanceTokenUser: toWeiString(10),
      balanceWeiHub: toWeiString(0),
      balanceWeiUser: toWeiString(0),
    })
    await service.doRequestWithdrawal(
      channel.user,
      {
        recipient: mkAddress('0x666'),
        exchangeRate: '123.45',
        tokensToSell: toWeiBigNum(1),
        withdrawalWeiUser: toWeiBigNum(0)
      }
    )
    const withdrawal = await service.redisGetUnsignedState(channel.user)

    assertChannelStateEqual(withdrawal.state, {
      recipient: mkAddress('0x666'),
      balanceTokenHub: '0',
      balanceTokenUser: toWeiString(9),
      balanceWeiHub: '0',
      balanceWeiUser: toWeiBigNum(0),
      pendingWithdrawalTokenHub: toWeiBigNum(11),
      pendingWithdrawalWeiHub: toWeiBigNum(0),
      pendingDepositWeiUser: Big('8100445524503847'),
      pendingWithdrawalWeiUser: '8100445524503847',
    })
  })

  // TODO: REB-60
  it.skip('withdrawal where hub deposits booty', async () => {
    const channel = await channelUpdateFactory(registry, {
      balanceTokenHub: toWeiString(0),
      balanceTokenUser: toWeiString(10),
      balanceWeiHub: toWeiString(0),
      balanceWeiUser: toWeiString(10),
    })
    await service.doRequestWithdrawal(
      channel.user,
      {
        recipient: mkAddress('0x666'),
        exchangeRate: '123.45',
        tokensToSell: toWeiBigNum(1),
        withdrawalTokenUser: toWeiBigNum(0),
        withdrawalWeiUser: toWeiBigNum(3),
      }
    )
    const withdrawal = await service.redisGetUnsignedState(channel.user)
    withdrawal.state.timeout = 0
    assertChannelStateEqual(withdrawal.state, {
      recipient: mkAddress('0x666'),
      balanceTokenUser: toWeiString(9),
      balanceWeiHub: '0',
      balanceWeiUser: toWeiBigNum(7),
      pendingWithdrawalWeiHub: '0',
      pendingWithdrawalWeiUser: '3008100445524503847',
      pendingWithdrawalTokenHub: '0',
      pendingDepositWeiUser: '8100445524503847',
      pendingDepositTokenHub: CHANNEL_BOOTY_LIMIT.sub(toWeiBigNum(1)),
    })
  })

  // describe('Withdrawal generated cases', () => {
  //   function makeBigNumsBigger(x: any) {
  //     for (let key in x) if (isBigNum(x[key])) x[key] = x[key].mul('1e18')
  //     return x
  //   }
  //   extractWithdrawalOverrides().forEach(wd => {
  //     it(`${wd.name}: ${wd.desc.replace(/^\s*/, '').replace(/\s*$/, '').replace(/\n/g, ', ')}`, async () => {
  //       let { prev, args, request } = createWithdrawalParams(wd, 'bignumber')
  //       prev = makeBigNumsBigger(prev)
  //       request = {
  //         wei: toWeiBigNum(request.wei),
  //         token: toWeiBigNum(request.token),
  //       }

  //       const channel = await channelUpdateFactory(
  //         registry,
  //         prev,
  //       )

  //       const actualArgs = await service.doRequestWithdrawal(
  //         channel.user,
  //         request.wei,
  //         request.token,
  //         mkAddress('0x666'),
  //       )

  //       delete args.timeout

  //       const expected = makeBigNumsBigger(
  //         convertWithdrawal('bignumber', {
  //           ...args,
  //           exchangeRate: '123.45',
  //           recipient: mkAddress('0x666'),
  //         }),
  //       )
  //       assert.containSubset(actualArgs, convertWithdrawal('str', expected))
  //     })
  //   })
  // })

  it('should sync channel and thread updates', async () => {
    const user = mkAddress('0xabc')
    const receiver = mkAddress('0xaaa')
    let channelState = getChannelState('empty', {
      user,
      contractAddress: contract,
      sigHub: mkSig('0x789'),
      sigUser: mkSig('0x234'),
    })
    let update = await channelsDao.applyUpdateByUser(
      user,
      'ConfirmPending',
      user,
      channelState,
      {},
    )

    let channelState2 = getChannelState('empty', {
      user: receiver,
      contractAddress: contract,
      sigHub: mkSig('0x789'),
      sigUser: mkSig('0x234'),
    })
    await channelsDao.applyUpdateByUser(
      receiver,
      'ConfirmPending',
      receiver,
      channelState2,
      {},
    )

    let threadState = getThreadState('empty', {
      sender: user,
      receiver,
      balanceTokenSender: '10',
      contractAddress: contract,
      sigA: mkSig('0x987'),
    })
    await threadsDao.applyThreadUpdate(threadState, update.id)

    const syncUpdates = await service.getChannelAndThreadUpdatesForSync(
      user,
      0,
      0,
    )

    assert.deepEqual(syncUpdates.map(s => s.type), ['channel', 'thread'])
  })
})
