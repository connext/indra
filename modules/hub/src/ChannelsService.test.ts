import { parameterizedTests } from './testing'
import ChannelsDao, { PostgresChannelsDao } from './dao/ChannelsDao'
import ChannelsService from './ChannelsService'
import { getTestRegistry, assert, getFakeClock, nock } from './testing'
import {
  MockExchangeRateDao,
  MockGasEstimateDao,
  mockRate,
  MockSignerService,
  fakeSig,
  getTestConfig,
  getMockWeb3
} from './testing/mocks'
import {
  getChannelState,
  assertChannelStateEqual,
  mkAddress,
  mkSig,
  getThreadState,
  mkHash,
  PartialSignedOrSuccinctChannel,
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
  PaymentArgs,
  isBigNum,
  convertWithdrawal,
  Payment,
  InvalidationArgs,
  WithdrawalArgs,
  WithdrawalParametersBigNumber,
  UpdateRequestBigNumber,
  DepositArgsBigNumber,
} from './vendor/connext/types'
import Web3 = require('web3')
import ThreadsDao from './dao/ThreadsDao'
import {
  channelUpdateFactory,
  tokenVal,
  channelAndThreadFactory,
} from './testing/factories'
import { StateGenerator } from './vendor/connext/StateGenerator'
import PaymentsService from './PaymentsService';
import { extractWithdrawalOverrides, createWithdrawalParams } from './testing/generate-withdrawal-states';
import Config from './Config';
import { BigNumber } from 'bignumber.js/bignumber'
import ChannelDisputesDao from './dao/ChannelDisputesDao';
import { RedisClient } from './RedisClient'
import ThreadsService from './ThreadsService';
import DBEngine, { SQL } from './DBEngine';
import { OnchainTransactionsDao } from './dao/OnchainTransactionsDao';
import { OnchainTransactionService } from './OnchainTransactionService';

function fieldsToWei<T>(obj: T): T {
  const res = {} as any
  for (let field in obj)
    res[field] = Big(obj[field as string]).times('1e18').toFixed()

  return res
}

const contract = mkAddress('0xCCC')

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

describe('ChannelsService', () => {
  const clock = getFakeClock()
  const registry = getTestRegistry({
    Web3: getMockWeb3(),
    GasEstimateDao: new MockGasEstimateDao()
  })

  const channelsDao: PostgresChannelsDao = registry.get('ChannelsDao')
  const service: ChannelsService = registry.get('ChannelsService')
  const threadsDao: ThreadsDao = registry.get('ThreadsDao')
  const stateGenerator: StateGenerator = registry.get('StateGenerator')
  const paymentsService: PaymentsService = registry.get('PaymentsService')
  const config: Config = registry.get('Config')
  const startExitDao: ChannelDisputesDao = registry.get('ChannelDisputesDao')
  const threadsService: ThreadsService = registry.get('ThreadsService')
  const onchainTxDao: OnchainTransactionsDao = registry.get('OnchainTransactionsDao')
  const db: DBEngine = registry.get('DBEngine')

  beforeEach(async function () {
    await registry.clearDatabase()
  })

  it('should create an update for a user deposit request when channel does not exist', async () => {
    const weiDeposit = toWeiBigNum(0.1)
    const user = mkAddress('0xa')
    const timeout = Math.floor(Date.now() / 1000) + 5 * 60

    await service.doRequestDeposit(user, weiDeposit, Big(0), mkSig())

    const {updates} = await service.getChannelAndThreadUpdatesForSync(
      user,
      0,
      0,
    )
    const [updateRequest] = updates
    const pendingDepositTokenHub = weiDeposit.times(mockRate)

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
    await service.doRequestDeposit(chan.state.user, Big(weiDeposit), Big(0), mkHash('0xsigUser'))

    const {updates: syncUpdates} = await service.getChannelAndThreadUpdatesForSync(
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
    await service.doRequestDeposit(chan.state.user, weiDeposit, Big(0), mkSig())
    const {updates: syncUpdates} = await service.getChannelAndThreadUpdatesForSync(
      chan.state.user,
      0,
      0,
    )
    const latestState = syncUpdates[syncUpdates.length - 1]

    assert.equal(
      (latestState.update as UpdateRequest).reason,
      'ProposePendingDeposit' as ChannelUpdateReason,
    )
    const pendingDepositTokenHub = config.channelBeiDeposit.minus(
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
    await service.doRequestDeposit(chan.state.user, weiDeposit, Big(0), mkSig())
    const {updates: syncUpdates} = await service.getChannelAndThreadUpdatesForSync(
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
      .times(mockRate)
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

  it('should fail if the requested update is not properly signed (no sig)', async () => {
    const weiDeposit = toWeiBigNum(0.1)
    const user = mkAddress('0xa')

    await assert.isRejected(service.doRequestDeposit(user, weiDeposit, Big(0), ""),
      /No signature detected/
    )
  })

  async function runExchangeTest(
    initialChannelState: PartialSignedOrSuccinctChannel,
    exchangeAmounts: Payment<BigNumber>,
    expectedState: PartialSignedOrSuccinctChannel,
  ) {
  }

  type ExchangeTestType = {
    name: string
    initial: PartialSignedOrSuccinctChannel
    exchange: Payment<number>
    expected: PartialSignedOrSuccinctChannel
  }

  /**
   * Beacuse exchange rates will lead to not-quite-round numbers, the
   * `tweakBalance` function makes those numbers cleaner to express.
   * For example:
   *  > tweakBalance(1, 69)
   *  '1.000...069'
   *  > tweakBalance(1, -1)
   *  '0.999...999'
   */
  function tweakBalance(ethAmt: number, weiAmt: number, mul = false): string {
    const res = Big(ethAmt).plus(Big(weiAmt).div('1e18'))
    return (mul ? res.times('1e18') : res).toFixed()
  }

  const exchangeTests: ExchangeTestType[] = [
    {
      name: 'should exchange user eth for booty - happy case',
      initial: {
        balanceTokenHub: 69.1,
        balanceWeiUser: 1,
      },
      exchange: {
        amountToken: 0,
        amountWei: 1,
      },
      expected: {
        balanceTokenUser: tweakBalance(69, 975),
      },
    },

    {
      name: 'should limit exchanges to hub booty balance',
      initial: {
        balanceTokenHub: 10,
        balanceWeiUser: 1,
      },
      exchange: {
        amountToken: 0,
        amountWei: 1,
      },
      expected: {
        balanceTokenUser: tweakBalance(10, -15),
        balanceTokenHub: tweakBalance(0, 15),
      },
    },

    {
      name: 'should exchange eth for booty in channel - happy case',
      initial: {
        balanceWeiHub: 10,
        balanceTokenUser: 20,
      },

      exchange: {
        amountToken: 10,
        amountWei: 0,
      },

      expected: {
        balanceWeiUser: Big(10).div(123.45).times('1e18').floor().div('1e18').toFixed(),
        balanceTokenUser: tweakBalance(10, 28),
      },
    },

    {
      name: 'should limit exchanges to hub wei balance',
      initial: {
        balanceWeiHub: 1,
        balanceTokenUser: 200,
      },

      exchange: {
        amountToken: 200,
        amountWei: 0,
      },

      expected: {
        balanceWeiUser: 1,
        balanceWeiHub: 0,
      },
    },

    {
      name: 'should not exchange if there\'s nothing to exchange',
      initial: {
        balanceWeiHub: 0,
        balanceTokenUser: 0,
      },

      exchange: {
        amountToken: 200,
        amountWei: 0,
      },

      expected: null,
    },
  ]

  describe('doRequestExchange', () => {
    exchangeTests.forEach(t => {
      it(t.name, async () => {
        const channel = await channelUpdateFactory(registry, {
          contractAddress: contract,
          ...fieldsToWei(t.initial),
        })

        const exchangeArgs = await service.doRequestExchange(
          channel.user,
          Big(t.exchange.amountWei).times('1e18'),
          Big(t.exchange.amountToken).times('1e18'),
        )
        const res = await service.redisGetUnsignedState('any', channel.user)
        assert.deepEqual(res && res.update.args, exchangeArgs)
      })
    })
  })

  it('should onboard a performer by collateralizing their channel - happy case', async () => {
    const user = mkAddress('0xabc')

    const depositArgs = await service.doCollateralizeIfNecessary(user)
    const res = await service.redisGetUnsignedState('any', user)
    assert.deepEqual(res.update.args, depositArgs)
  })

  // TODO: enable this when threads are working
  it.skip('should recollateralize a performer channel when they have threads open', async () => {
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
    )
    const res = await service.redisGetUnsignedState('any', threadUsers.performer.user)
    assert.deepEqual(res.update.args, depositArgs)
  })

  // RECENT TIPPER TESTS
  it('should collateralize with the minimum amount if there are no recent tippers', async () => {
    const channel = await channelUpdateFactory(registry)

    await service.doCollateralizeIfNecessary(channel.user)
    const {updates} = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    const latestUpdate = updates.pop()

    const state = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', channel.state),
      convertDeposit('bn', (latestUpdate.update as UpdateRequest).args as DepositArgs)
    )
    assertChannelStateEqual(state, {
      pendingDepositTokenHub: toWeiString(10)
    })
  })

  it('should collateralize with the amount of recent tippers', async () => {
    const channel = await channelUpdateFactory(registry, { balanceTokenHub: toWeiString(10) })

    for (let i = 0; i < 5; i++) {
      const tipper = await channelUpdateFactory(registry, { user: mkAddress(`0x${i}`), balanceTokenUser: toWeiString(5) })
      await paymentsService.doPurchase(tipper.user, {}, [{
        recipient: channel.user,
        meta: {},
        amount: {
          amountToken: toWeiString(1),
          amountWei: '0'
        },
        type: 'PT_CHANNEL',
        update: {
          args: {
            amountToken: toWeiString(1),
            amountWei: '0',
            recipient: 'hub'
          } as PaymentArgs,
          reason: 'Payment',
          txCount: tipper.update.state.txCountGlobal + 1
        }
      }])
    }

    await service.redisDeleteUnsignedState(channel.user)
    await service.doCollateralizeIfNecessary(channel.user)
    const {updates} = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    const latestUpdate = updates.pop()

    const state = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', channel.state),
      convertDeposit('bn', (latestUpdate.update as UpdateRequest).args as DepositArgs)
    )

    // target should be:
    // num tippers * threadBeiLimit * max collat multiple - bal token hub
    const collateralizationTarget = Big(5)
      .times(config.beiMinCollateralization)
      .times(config.maxCollateralizationMultiple)
      .minus(toWeiString(5))
      .toFixed()
    assertChannelStateEqual(state, {
      pendingDepositTokenHub: collateralizationTarget
    })
  })

  it('should collateralize to the max amount', async () => {
    const channel = await channelUpdateFactory(registry, { balanceTokenHub: toWeiString(20) })

    for (let i = 0; i < 20; i++) {
      const tipper = await channelUpdateFactory(registry, { user: mkAddress(`0x${i.toString() + 'f'}`), balanceTokenUser: toWeiString(5) })
      await paymentsService.doPurchase(tipper.user, {}, [{
        recipient: channel.user,
        meta: {},
        amount: {
          amountToken: toWeiString(1),
          amountWei: '0'
        },
        type: 'PT_CHANNEL',
        update: {
          args: {
            amountToken: toWeiString(1),
            amountWei: '0',
            recipient: 'hub'
          } as PaymentArgs,
          reason: 'Payment',
          txCount: tipper.update.state.txCountGlobal + 1
        }
      }])
    }

    await service.redisDeleteUnsignedState(channel.user)
    await service.doCollateralizeIfNecessary(channel.user)
    const {updates} = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    const latestUpdate = updates.pop()

    const state = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', channel.state),
      convertDeposit('bn', (latestUpdate.update as UpdateRequest).args as DepositArgs)
    )

    assertChannelStateEqual(state, {
      pendingDepositTokenHub: config.beiMaxCollateralization.toFixed()
    })
  }).timeout(5000)

  it('should manually collateralize to a target', async () => {
    const channel = await channelUpdateFactory(registry, { balanceTokenHub: toWeiString(20) })

    await service.doCollateralizeIfNecessary(channel.user, toWeiBigNum(100))
    const {updates} = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    const latestUpdate = updates.pop()

    const state = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', channel.state),
      convertDeposit('bn', (latestUpdate.update as UpdateRequest).args as DepositArgs)
    )

    assertChannelStateEqual(state, {
      pendingDepositTokenHub: toWeiString(80)
    })
  })

  it('should manually collateralize not exceeding channel max', async () => {
    const channel = await channelUpdateFactory(registry, { balanceTokenHub: toWeiString(20) })

    await service.doCollateralizeIfNecessary(channel.user, toWeiBigNum(200))
    const {updates} = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    const latestUpdate = updates.pop()

    const state = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', channel.state),
      convertDeposit('bn', (latestUpdate.update as UpdateRequest).args as DepositArgs)
    )

    assertChannelStateEqual(state, {
      pendingDepositTokenHub: toWeiString(149)
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

    let {updates: syncUpdates} = await service.getChannelAndThreadUpdatesForSync(
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
        pendingDepositTokenHub: toWeiString(10),
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

    let {updates: syncUpdates} = await service.getChannelAndThreadUpdatesForSync(
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
      balanceTokenHub: tweakBalance(10, -28, true),
      balanceTokenUser: tweakBalance(10, 28, true),
      txCount: [2, 1],
    })
  })

  async function runWithdrawalTest(
    initial: Partial<ChannelState>,
    params: Partial<WithdrawalParametersBigNumber>,
    expected: Partial<WithdrawalArgs> | null | RegExp,
  ) {
    const channel = await channelUpdateFactory(registry, {
      balanceTokenHub: toWeiString(0),
      balanceTokenUser: toWeiString(0),
      balanceWeiHub: toWeiString(0),
      balanceWeiUser: toWeiString(0),
      ...initial,
    })
    const resPromise = service.doRequestWithdrawal(
      channel.user,
      {
        recipient: mkAddress('0x666'),
        exchangeRate: '123.45',
        tokensToSell: toWeiBigNum(0),
        withdrawalWeiUser: toWeiBigNum(0),
        ...params,
      }
    )

    if (expected instanceof RegExp) {
      await assert.isRejected(resPromise, expected)
      return
    }

    await resPromise

    const withdrawal = await service.redisGetUnsignedState('any', channel.user)
    if (!expected) {
      assert.isNotOk(withdrawal)
      return
    }

    assert.isOk((withdrawal.update.args as any).timeout)
    assert.containSubset(withdrawal.update.args, {
      additionalTokenHubToUser: '0',
      additionalWeiHubToUser: '0',
      exchangeRate: '123.45',
      seller: 'user',
      targetTokenHub: '0',
      targetTokenUser: '0',
      targetWeiHub: '0',
      targetWeiUser: '0',
      tokensToSell: '0',
      weiToSell: '0',
      ...expected,
    })

  }

  it('withdrawal where hub withdraws booty', async () => {
    await runWithdrawalTest(
      {
        balanceTokenHub: toWeiString(10),
        balanceTokenUser: toWeiString(10),
      },
      {
        tokensToSell: toWeiBigNum(1),
        withdrawalWeiUser: toWeiBigNum(0)
      },
      {
        targetTokenHub: '0',
        targetTokenUser: '9000000000000000000',
        tokensToSell: '1000000000000000000',
      },
    )
  })

  it('should not allow negative withdrawals', async () => {
    await runWithdrawalTest(
      {},
      {
        withdrawalWeiUser: toWeiBigNum('-1'),
      },
      /negative/,
    )
  })

  it('withdrawal should be ignored if nothing will be withdrawn', async () => {
    await runWithdrawalTest(
      {},
      {}, // Don't request any withdrawals (ie, all values are 0)
      null, // And we shouldn't get anything
    )
  })

  // TODO: REB-60
  it('withdrawal where hub deposits booty', async () => {
    await runWithdrawalTest(
      {
        balanceTokenUser: toWeiString(10),
        balanceWeiUser: toWeiString(10),
      },

      {
        tokensToSell: toWeiBigNum(1),
        withdrawalTokenUser: toWeiBigNum(0),
        withdrawalWeiUser: toWeiBigNum(3),
      },

      {
        targetTokenHub: '69000000000000000000',
        targetTokenUser: '9000000000000000000',
        targetWeiUser: '7000000000000000000',
        tokensToSell: '1000000000000000000',
      },
    )
  })

  it('does not check when NO_CHECK is used', async () => {
    const registry = getTestRegistry({
      Config: getTestConfig({
        shouldCollateralizeUrl: 'NO_CHECK',
        isDev: false,
      }),
    })
    const service: ChannelsService = registry.get('ChannelsService')
    assert.equal(await service.shouldCollateralize('0x1234'), true)
  })

  it('does not invalidate when there is a submitted tx', async () => {
    const chan = await channelUpdateFactory(registry)
    await service.doCollateralizeIfNecessary(chan.user)
    let sync = await service.getChannelAndThreadUpdatesForSync(chan.user, 0, 0)
    const latest = sync.updates.pop()

    // simulate collateralization
    await service.doUpdates(chan.user, [{
      args: convertDeposit('bignumber', (latest.update as UpdateRequest).args as DepositArgs),
      reason: 'ProposePendingDeposit',
      txCount: chan.state.txCountGlobal + 1,
      sigUser: mkSig()
    }])

    const deposit = await channelsDao.getChannelUpdateByTxCount(chan.user, chan.state.txCountGlobal + 1)
    let tx = await onchainTxDao.getTransactionByLogicalId(db, deposit.onchainTxLogicalId)
    assert.equal(tx.state, 'submitted')

    await service.doUpdates(chan.user, [{
      args: {
        previousValidTxCount: chan.state.txCountGlobal,
        lastInvalidTxCount: chan.state.txCountGlobal + 1,
        reason: 'CU_INVALID_ERROR',
      } as InvalidationArgs,
      reason: 'Invalidation',
      txCount: chan.state.txCountGlobal + 2,
      sigUser: mkSig()
    }])

    sync = await service.getChannelAndThreadUpdatesForSync(chan.user, 0, 0)
    const invalidation = sync.updates.filter(u => (u.update as UpdateRequest).reason === 'Invalidation')
    assert.isEmpty(invalidation)

    tx = await onchainTxDao.getTransactionByLogicalId(db, deposit.onchainTxLogicalId)
    assert.equal(tx.state, 'submitted')
  })

  it('allows invalidation and marks a new onchain tx as failed', async () => {
    const registry = getTestRegistry({
      Web3: {
        ...getMockWeb3(),
        eth: {
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
                    return cb('Invalid JSON RPC response')
                }
              },
            }
          },
          sendTransaction: function () {
            console.log(`Called mocked web3 function sendTransaction`)
            return this.sendSignedTransaction()
          },
          getBlock: async () => {
            return 1
          }
        },
      },
      GasEstimateDao: new MockGasEstimateDao()
    })
    const service: ChannelsService = registry.get('ChannelsService')

    const chan = await channelUpdateFactory(registry)
    await service.doCollateralizeIfNecessary(chan.user)
    let sync = await service.getChannelAndThreadUpdatesForSync(chan.user, 0, 0)
    let latest = sync.updates.pop()

    // simulate collateralization
    await service.doUpdates(chan.user, [{
      args: convertDeposit('bignumber', (latest.update as UpdateRequest).args as DepositArgs),
      reason: 'ProposePendingDeposit',
      txCount: chan.state.txCountGlobal + 1,
      sigUser: mkSig()
    }])

    const deposit = await channelsDao.getChannelUpdateByTxCount(chan.user, chan.state.txCountGlobal + 1)
    let tx = await onchainTxDao.getTransactionByLogicalId(db, deposit.onchainTxLogicalId)
    assert.equal(tx.state, 'new')

    await service.doUpdates(chan.user, [{
      args: {
        previousValidTxCount: chan.state.txCountGlobal,
        lastInvalidTxCount: chan.state.txCountGlobal + 1,
        reason: 'CU_INVALID_ERROR',
      } as InvalidationArgs,
      reason: 'Invalidation',
      txCount: chan.state.txCountGlobal + 2,
      sigUser: mkSig()
    }])

    sync = await service.getChannelAndThreadUpdatesForSync(chan.user, 0, 0)
    latest = sync.updates.pop()
    assert.equal((latest.update as UpdateRequest).reason, 'Invalidation')

    tx = await onchainTxDao.getTransactionByLogicalId(db, deposit.onchainTxLogicalId)
    assert.equal(tx.state, 'failed')
  })

  describe('Withdrawal generated cases', () => {
    function makeBigNumsBigger(x: any) {
      for (let key in x) if (isBigNum(x[key])) x[key] = x[key].times('1e18')
      return x
    }
    extractWithdrawalOverrides().forEach(wd => {
      it(`${wd.name}: ${wd.desc.replace(/^\s*/, '').replace(/\s*$/, '').replace(/\n/g, ', ')}`, async () => {
        let { prev, args, request } = createWithdrawalParams(wd, 'bignumber')
        prev = makeBigNumsBigger(prev)
        request = {
          wei: toWeiBigNum(request.wei),
          token: toWeiBigNum(request.token),
        }

        const channel = await channelUpdateFactory(
          registry,
          prev,
        )

        const actualArgs = await service.doRequestWithdrawal(
          channel.user,
          {
            exchangeRate: '123.45',
            recipient: mkAddress('0x666'),
            tokensToSell: request.token,
            withdrawalWeiUser: request.wei
          }
        )

        delete args.timeout

        const expected = makeBigNumsBigger(
          convertWithdrawal('bignumber', {
            ...args,
            exchangeRate: '123.45',
            recipient: mkAddress('0x666'),
          }),
        )
        assert.containSubset(actualArgs, convertWithdrawal('str', expected))
      }).timeout(5000)
    })
  })

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

    const {updates: syncUpdates} = await service.getChannelAndThreadUpdatesForSync(
      user,
      0,
      0,
    )

    assert.deepEqual(syncUpdates.map(s => s.type), ['channel', 'thread'])
  })

  it('should not recollateralize with pending states', async () => {
    const channel = await channelUpdateFactory(registry, {
      pendingDepositTokenHub: '1'
    })
    console.log(convertChannelState('str', channel.state))

    const args = await service.doCollateralizeIfNecessary(channel.user)
    assert.isNull(args)
  })

  it('should sign an invalidating update', async () => {
    let channel = await channelUpdateFactory(registry)
    channel = await channelUpdateFactory(registry, {
      balanceToken: [100, 175],
      txCountGlobal: channel.state.txCountGlobal + 1
    })
    channel = await channelUpdateFactory(registry, {
      ...channel.state,
      pendingDepositToken: [1, 2],
      pendingDepositWei: [3, 4],
      pendingWithdrawalToken: [5, 6],
      pendingWithdrawalWei: [7, 8],
      txCountGlobal: channel.state.txCountGlobal + 1
    })
    channel = await channelUpdateFactory(registry, {
      ...channel.state,
      txCountGlobal: channel.state.txCountGlobal + 1,
      sigUser: null
    })
    channel = await channelUpdateFactory(registry, {
      ...channel.state,
      txCountGlobal: channel.state.txCountGlobal + 1,
      sigUser: null
    })

    await service.doUpdates(channel.user, [{
      reason: 'Invalidation',
      args: {
        reason: 'CU_INVALID_TIMEOUT',
        previousValidTxCount: 2,
        lastInvalidTxCount: 5
      } as InvalidationArgs,
      txCount: channel.state.txCountGlobal + 1,
      sigUser: mkSig('0xa')
    }])

    for (const txCount of [3, 4, 5]) {
      const update = await channelsDao.getChannelUpdateByTxCount(channel.user, txCount)
      assert.equal(update.invalid, 'CU_INVALID_TIMEOUT')
    }

    let chan = await channelsDao.getChannelByUser(channel.user)
    assertChannelStateEqual(
      convertChannelState('str', chan.state),
      {
        pendingDepositToken: [0, 0],
        pendingDepositWei: [0, 0],
        pendingWithdrawalToken: [0, 0],
        pendingWithdrawalWei: [0, 0],
        txCountGlobal: channel.state.txCountGlobal + 1,
        sigHub: fakeSig
      }
    )
  })

  it('should invalidate the first transaction if its bad', async () => {
    let channel = await channelUpdateFactory(registry, {
      pendingDepositToken: [1, 2],
      pendingDepositWei: [3, 4]
    })

    await service.doUpdates(channel.user, [{
      reason: 'Invalidation',
      args: {
        reason: 'CU_INVALID_TIMEOUT',
        previousValidTxCount: 0,
        lastInvalidTxCount: 1
      } as InvalidationArgs,
      txCount: channel.state.txCountGlobal + 1,
      sigUser: mkSig('0xa')
    }])

    let chan = await channelsDao.getChannelByUser(channel.user)
    assertChannelStateEqual(
      convertChannelState('str', chan.state),
      {
        pendingDepositToken: [0, 0],
        pendingDepositWei: [0, 0],
        pendingWithdrawalToken: [0, 0],
        pendingWithdrawalWei: [0, 0],
        txCountGlobal: channel.state.txCountGlobal + 1,
        sigHub: fakeSig
      }
    )
  })

  it('should not accept an invalidation on a state that has not expired the timeout', async () => {
    let channel = await channelUpdateFactory(registry)
    channel = await channelUpdateFactory(registry, {
      pendingDepositToken: [1, 2],
      pendingDepositWei: [3, 4],
      txCountGlobal: channel.state.txCountGlobal + 1,
      timeout: Math.floor(Date.now() / 1000) + 3
    })

    const invalidationArgs: InvalidationArgs = {
      lastInvalidTxCount: channel.state.txCountGlobal,
      previousValidTxCount: channel.state.txCountGlobal - 1,
      reason: 'CU_INVALID_ERROR'
    }

    await service.doUpdates(channel.user, [{
      args: invalidationArgs,
      reason: 'Invalidation',
      sigUser: fakeSig,
      txCount: channel.state.txCountGlobal + 1
    }])

    const {updates: sync} = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    assert.deepEqual(sync.map(item => (item.update as UpdateRequest).reason), ['ConfirmPending', 'ConfirmPending'])
    // make sure it didnt get invalidated
    assert.isEmpty(sync.filter(item => (item.update as UpdateRequest).reason == 'Invalidation'))
  })

  it('should accept an invalidation on a state that has expired the timeout', async () => {
    let channel = await channelUpdateFactory(registry)
    channel = await channelUpdateFactory(registry, {
      pendingDepositToken: [1, 2],
      pendingDepositWei: [3, 4],
      txCountGlobal: channel.state.txCountGlobal + 1,
      timeout: Math.floor(Date.now() / 1000) + 1
    })

    await clock.awaitTicks(2000)

    const invalidationArgs: InvalidationArgs = {
      lastInvalidTxCount: channel.state.txCountGlobal,
      previousValidTxCount: channel.state.txCountGlobal - 1,
      reason: 'CU_INVALID_ERROR'
    }

    await service.doUpdates(channel.user, [{
      args: invalidationArgs,
      reason: 'Invalidation',
      sigUser: fakeSig,
      txCount: channel.state.txCountGlobal + 1
    }])

    const {updates: sync} = await service.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    assert.deepEqual(sync.map(item => (item.update as UpdateRequest).reason), ['ConfirmPending', 'Invalidation'])
  })

  it('does not return sync updates from closed threads', async () => {
    const channel = await channelAndThreadFactory(registry)
    await threadsService.close(channel.user.user, channel.performer.user, mkSig('0xa'), true)
    const t = await threadsDao.getThread(channel.user.user, channel.performer.user, channel.thread.threadId)
    assert.equal(t.status, 'CT_CLOSED')

    const sync = await service.getChannelAndThreadUpdatesForSync(channel.user.user, 0, 0)
    const threadUpdates = sync.updates.filter(update => update.type === 'thread')
    assert.deepEqual(threadUpdates, [])
  })
})

describe('ChannelsService.shouldCollateralize', () => {
  const registry = getTestRegistry({
    Config: getTestConfig({
      shouldCollateralizeUrl: 'https://example.com/should-collateralize/',
      isDev: false,
    }),
  })

  const service: ChannelsService = registry.get('ChannelsService')
  const redis: RedisClient = registry.get('RedisClient')

  parameterizedTests([
    { name: 'works: true', shouldCollateralize: true },
    { name: 'works: false', shouldCollateralize: false },
    { name: 'returns false on error', shouldCollateralize: Error('uhoh') },
  ], async t => {
    nock('https://example.com')
      .get(/.*/)
      .reply(url => {
        assert.equal(url, '/should-collateralize/0x1234')
        if (t.shouldCollateralize instanceof Error)
          throw t.shouldCollateralize
        return [200, { shouldCollateralize: t.shouldCollateralize }]
      })

    await redis.flushall()
    const res = await service.shouldCollateralize('0x1234')
    const expected = t.shouldCollateralize instanceof Error ? false : t.shouldCollateralize
    assert.equal(res, expected)
  })

  describe('ChannelsService-txFail', () => {
    const clock = getFakeClock()
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
          getTransaction: async () => {
            return {
              hello: 'world'
            }
          }
        },
      },
      ExchangeRateDao: new MockExchangeRateDao(),
      GasEstimateDao: new MockGasEstimateDao(),
    })
  
    const service: ChannelsService = registry.get('ChannelsService')
    const stateGenerator: StateGenerator = registry.get('StateGenerator')
    const txService: OnchainTransactionService = registry.get('OnchainTransactionService')
    const db: DBEngine = registry.get('DBEngine')
  
    beforeEach(async () => {
      await registry.clearDatabase()
    })
  
    it('should invalidate a failing hub authorized update', async () => {
      const registry = getTestRegistry({
        Web3: {
          ...getMockWeb3(),
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
            getTransaction: async () => {
              return null
            }
          },
        },
        ExchangeRateDao: new MockExchangeRateDao(),
        GasEstimateDao: new MockGasEstimateDao(),
      })
    
      const service: ChannelsService = registry.get('ChannelsService')
      const stateGenerator: StateGenerator = registry.get('StateGenerator')
      const txService: OnchainTransactionService = registry.get('OnchainTransactionService')
      const db: DBEngine = registry.get('DBEngine')

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

      await db.query(SQL`
      UPDATE onchain_transactions_raw SET hash = ${mkHash()}
      `)
      await txService.poll()
      // need to wait a long time bc the timer resets
      await clock.awaitTicks(9553715125000)
      await txService.poll()
  
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
})
