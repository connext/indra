import { PostgresChannelsDao } from './dao/ChannelsDao'
import ChannelsService, { CHANNEL_BOOTY_LIMIT } from './ChannelsService'
import { getTestRegistry, assert } from './testing'
import { getTestConfig, MockExchangeRateDao, MockGasEstimateDao, mockRate } from './testing/mocks'
import {
  getChannelState,
  assertChannelStateEqual,
  mkAddress,
  mkSig,
  getThreadState,
  assertThreadStateEqual,
  mkHash,
} from './testing/stateUtils'
import { Big, toWeiBigNum, toWeiString } from './util/bigNumber'
import {
  ChannelState,
  ChannelStateUpdate,
  ThreadState,
} from './vendor/connext/types'
import Web3 = require('web3')
import ThreadsDao from './dao/ThreadsDao';
import { channelUpdateFactory, tokenVal, channelAndThreadFactory, exchangeRateFactory } from './testing/factories';

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
        }
      }
    }
  }
}

const contract = mkAddress('0xCCC')
const fakeSig = mkSig('0xfff')

describe('ChannelsService', () => {
  const registry = getTestRegistry({
    Web3: {
      ...Web3,
      eth: {
        Contract: web3ContractMock,
        sign: async () => {
          return fakeSig
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
              v: '0x27'
            }
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
            }
          }
        }
      },
    },
    Config: getTestConfig({
      channelManagerAddress: contract,
    }),
    ExchangeRateDao: new MockExchangeRateDao(),
    GasEstimateDao: new MockGasEstimateDao()
  })

  const channelsDao: PostgresChannelsDao = registry.get('ChannelsDao')
  const service: ChannelsService = registry.get('ChannelsService')
  const threadsDao: ThreadsDao = registry.get('ThreadsDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should create an update for a user deposit request when channel does not exist', async () => {
    const weiDeposit = toWeiBigNum(0.1)
    const user = mkAddress('0xa')

    const timeout = Math.floor(Date.now() / 1000) + 5 * 60
    await service.doRequestDeposit(user, weiDeposit, Big(0))
    const [latestState] = await service.getChannelAndThreadUpdatesForSync(
      user,
      0,
      0,
    )

    const pendingDepositTokenHub = weiDeposit.mul(mockRate)

    assert.equal(
      (latestState.state as ChannelStateUpdate).reason,
      'ProposePending',
    )
    assertChannelStateEqual(latestState.state.state as ChannelState, {
      sigHub: fakeSig,
      pendingDepositTokenHub,
      pendingDepositWeiUser: weiDeposit,
      txCountChain: 1,
      txCountGlobal: 1,
      timeout,
    })
  })

  it('should create a user deposit request when channel has enough booty to collateralize', async () => {
    const chan = await channelUpdateFactory(registry, 'ConfirmPending', {
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
      (latestState.state as ChannelStateUpdate).reason,
      'ProposePending',
    )
    assertChannelStateEqual(latestState.state.state as ChannelState, {
      pendingDepositTokenHub: 0,
      pendingDepositWeiUser: weiDeposit,
      timeout,
    })
  })

  it('should create a user deposit request when user deposits more than booty limit', async () => {
    const weiDeposit = toWeiBigNum(1)

    const chan = await channelUpdateFactory(registry, 'ConfirmPending', {
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
      (latestState.state as ChannelStateUpdate).reason,
      'ProposePending',
    )
    const pendingDepositTokenHub = CHANNEL_BOOTY_LIMIT.minus(
      chan.state.balanceTokenHub,
    )
    assertChannelStateEqual(latestState.state.state as ChannelState, {
      pendingDepositTokenHub,
      pendingDepositWeiUser: weiDeposit,
      timeout,
    })
  })

  it('should create a user deposit request when user deposits less than booty limit', async () => {
    const weiDeposit = toWeiBigNum('0.1')

    const chan = await channelUpdateFactory(registry, 'ConfirmPending', {
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
      (latestState.state as ChannelStateUpdate).reason,
      'ProposePending',
    )
    const pendingDepositTokenHub = weiDeposit
      .mul(mockRate)
      .minus(toWeiString(1))
    assertChannelStateEqual(latestState.state.state as ChannelState, {
      pendingDepositTokenHub,
      pendingDepositWeiUser: weiDeposit,
      timeout,
    })
  })

  it('should exchange eth for booty in channel - happy case', async () => {
    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      contractAddress: contract,
      balanceWeiUser: toWeiString(0.5),
      balanceTokenHub: toWeiString(69),
    })

    const unsigned = await service.doRequestExchange(
      channel.user,
      'BOOTY',
      toWeiBigNum(10),
    )

    const balanceWeiExchangeAmount = toWeiBigNum(10).dividedBy(mockRate).floor()

    assertChannelStateEqual(unsigned, {
      balanceWeiUser: Big(channel.state.balanceWeiUser)
        .minus(balanceWeiExchangeAmount)
        .toFixed(),
      balanceWeiHub: Big(channel.state.balanceWeiHub)
        .plus(balanceWeiExchangeAmount)
        .toFixed(),
      balanceTokenUser: toWeiString(10),
      balanceTokenHub: toWeiString(59),
    })
  })

  it('should onboard a performer by collateralizing their channel - happy case', async () => {
    const user = mkAddress('0xabc')

    const unsigned = await service.doRequestCollateral(user)

    assertChannelStateEqual(unsigned, {
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

    const unsigned = await service.doRequestCollateral(threadUsers.performer)

    assertChannelStateEqual(unsigned, {
      pendingDepositTokenHub: toWeiString(125),
      txCountGlobal: 2,
      txCountChain: 2,
    })
  })

  it('should onboard a performer with an onchain hubAuthorizedUpdate', async () => {
    const user = mkAddress('0xabc')
    const sigUser = mkSig('0xddd')

    const unsigned = await service.doRequestCollateral(user)
    unsigned.sigUser = sigUser

    await service.doUpdates(user, [
      {
        state: unsigned,
        reason: 'ProposePending',
      },
    ])

    let syncUpdates = await service.getChannelAndThreadUpdatesForSync(
      user,
      0,
      0,
    )
    const proposePending = syncUpdates[syncUpdates.length - 1]
      .state as ChannelStateUpdate
    proposePending.state.sigUser = sigUser

    assert.equal(proposePending.reason, 'ProposePending')
    assertChannelStateEqual(proposePending.state as ChannelState, {
      pendingDepositTokenHub: toWeiString(50),
      sigHub: fakeSig,
      sigUser,
      txCount: [1, 1],
    })
  })

  it('should verify an exchange', async () => {
    const sigUser = mkSig('0xa')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceWeiUser: toWeiString(0.5),
      balanceTokenHub: toWeiString(69),
    })

    const unsigned = await service.doRequestExchange(
      channel.user,
      'BOOTY',
      toWeiBigNum(10),
    )
    unsigned.sigUser = sigUser

    await service.doUpdates(channel.user, [
      {
        state: unsigned,
        reason: 'Exchange',
      },
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
      .state as ChannelStateUpdate

    assert.equal(exchangeUpdate.reason, 'Exchange')
    assertChannelStateEqual(exchangeUpdate.state, {
      balanceWeiHub: Big(channel.state.balanceWeiHub).plus(
        expectedExchangeAmountWei,
      ),
      balanceWeiUser: Big(channel.state.balanceWeiUser).minus(
        expectedExchangeAmountWei,
      ),
      balanceTokenHub: toWeiString(59),
      balanceTokenUser: toWeiString(10),
      txCount: [2, 1],
    })
  })

  // see doc for description of test cases: https://paper.dropbox.com/doc/SpankPay-BOOTY-Drop-2-CANONICAL-URLs--ASMKwGUa0N~99XhucAuz6IdiAg-Qpw2NAWgCIdg0Z5G9lpSu
  it('1. fully collateralized exchange, full withdrawal, no wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0.5)
    let balanceWeiUser = toWeiBigNum(0)

    let tokenWithdrawal = toWeiBigNum(10)
    let weiWithdrawal = toWeiBigNum(0)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = balanceTokenUser.div(mockRate).floor()

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: 0,
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: 0,
      pendingWithdrawalTokenHub: tokenWithdrawal,
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiHub: balanceWeiHub.minus(weiToUserWithdraw).toFixed(),
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed()
    })
  })

  it('2. partially collateralized exchange, full withdrawal, no wei in user channel', async () => {
    let balanceWeiHub = toWeiBigNum(0.01) // 123.45/100 = 1.2345
    let balanceTokenUser = toWeiBigNum(10)
    let recipient = mkAddress('0xfed')
    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
    })

    const weiToUserWithdraw = balanceTokenUser.div(mockRate).floor()

    const withdrawal = await service.doRequestWithdrawal(channel.user, toWeiBigNum(0), balanceTokenUser, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: 0,
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: weiToUserWithdraw.minus(balanceWeiHub),
      pendingWithdrawalTokenHub: balanceTokenUser.toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: 0
    })
  })

  it('3. uncollateralized exchange, full withdrawal, no wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0)
    let balanceWeiUser = toWeiBigNum(0)

    let tokenWithdrawal = toWeiBigNum(10)
    let weiWithdrawal = toWeiBigNum(0)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = balanceTokenUser.div(mockRate).floor()

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: 0,
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalTokenHub: balanceTokenUser.toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: 0
    })
  })

  it('4. fully collateralized, partial withdrawal, no wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0.5)
    let balanceWeiUser = toWeiBigNum(0)

    let tokenWithdrawal = toWeiBigNum(6)
    let weiWithdrawal = toWeiBigNum(0)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor()

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: balanceTokenUser.minus(tokenWithdrawal).toFixed(),
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: 0,
      pendingWithdrawalTokenHub: tokenWithdrawal.toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: balanceWeiHub.minus(weiToUserWithdraw).toFixed()
    })
  })

  it('5. partially collateralized, partial withdrawal, no wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0.01) // 123.45/100 = 1.2345
    let balanceWeiUser = toWeiBigNum(0)

    let tokenWithdrawal = toWeiBigNum(6)
    let weiWithdrawal = toWeiBigNum(0)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor()

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: balanceTokenUser.minus(tokenWithdrawal).toFixed(),
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: weiToUserWithdraw.minus(balanceWeiHub).toFixed(),
      pendingWithdrawalTokenHub: tokenWithdrawal.toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: 0
    })
  })

  it('6. uncollateralized, partial withdrawal, no wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0)
    let balanceWeiUser = toWeiBigNum(0)

    let tokenWithdrawal = toWeiBigNum(6)
    let weiWithdrawal = toWeiBigNum(0)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor()

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: balanceTokenUser.minus(tokenWithdrawal).toFixed(),
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalTokenHub: tokenWithdrawal.toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: 0
    })
  })

  it('7. fully collateralized, full withdrawals, wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0.5)
    let balanceWeiUser = toWeiBigNum(0.03)

    let tokenWithdrawal = toWeiBigNum(10)
    let weiWithdrawal = toWeiBigNum(0.03)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor().plus(weiWithdrawal)

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: 0,
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: 0,
      pendingWithdrawalTokenHub: tokenWithdrawal.toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: balanceWeiHub.minus(tokenWithdrawal.div(mockRate).floor()).toFixed()
    })
  })

  it('8. partially collateralized, full withdrawals, wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0.01)
    let balanceWeiUser = toWeiBigNum(0.03)

    let tokenWithdrawal = toWeiBigNum(10)
    let weiWithdrawal = toWeiBigNum(0.03)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor().plus(weiWithdrawal)

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: 0,
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: tokenWithdrawal.div(mockRate).floor().minus(balanceWeiHub).toFixed(),
      pendingWithdrawalTokenHub: tokenWithdrawal.toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: 0
    })
  })

  it('9. uncollateralized, full withdrawals, wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0)
    let balanceWeiUser = toWeiBigNum(0.03)

    let tokenWithdrawal = toWeiBigNum(10)
    let weiWithdrawal = toWeiBigNum(0.03)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor().plus(weiWithdrawal)

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: 0,
      balanceWeiHub: 0,
      balanceWeiUser: 0,
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: tokenWithdrawal.div(mockRate).floor().minus(balanceWeiHub).toFixed(),
      pendingWithdrawalTokenHub: tokenWithdrawal.toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: 0
    })
  })

  it('10. fully collateralized, partial withdrawal, wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(10)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0.5)
    let balanceWeiUser = toWeiBigNum(0.03)

    let tokenWithdrawal = toWeiBigNum(0)
    let weiWithdrawal = toWeiBigNum(0.02)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor().plus(weiWithdrawal)

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: balanceWeiUser.minus(weiWithdrawal).mul(mockRate).toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: 0,
      balanceWeiUser: balanceWeiUser.minus(weiWithdrawal).toFixed(),
      pendingDepositTokenHub: 0,
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: 0,
      pendingWithdrawalTokenHub: balanceTokenHub.minus(balanceWeiUser.minus(weiWithdrawal).mul(mockRate)).toFixed(),
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: balanceWeiHub.minus(tokenWithdrawal.div(mockRate).floor()).toFixed()
    })
  })

  it('11. partially collateralized, partial withdrawal, wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0.01)
    let balanceWeiUser = toWeiBigNum(0.03)

    let tokenWithdrawal = toWeiBigNum(0)
    let weiWithdrawal = toWeiBigNum(0.02)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor().plus(weiWithdrawal)

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: 0,
      balanceWeiUser: balanceWeiUser.minus(weiWithdrawal).toFixed(),
      pendingDepositTokenHub: balanceWeiUser.minus(weiWithdrawal).mul(mockRate).toFixed(),
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: 0,
      pendingWithdrawalTokenHub: 0,
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: weiToUserWithdraw.minus(balanceWeiHub).toFixed()
    })
  })

  it('12. uncollateralized, partial withdrawal, wei in user channel', async () => {
    let balanceTokenHub = toWeiBigNum(0)
    let balanceTokenUser = toWeiBigNum(10)
    let balanceWeiHub = toWeiBigNum(0)
    let balanceWeiUser = toWeiBigNum(0.03)

    let tokenWithdrawal = toWeiBigNum(0)
    let weiWithdrawal = toWeiBigNum(0.02)

    let recipient = mkAddress('0xfed')

    const channel = await channelUpdateFactory(registry, 'ConfirmPending', {
      balanceTokenHub: balanceTokenHub.toFixed(),
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: balanceWeiHub.toFixed(),
      balanceWeiUser: balanceWeiUser.toFixed(),
    })

    const weiToUserWithdraw = tokenWithdrawal.div(mockRate).floor().plus(weiWithdrawal)

    const withdrawal = await service.doRequestWithdrawal(channel.user, weiWithdrawal, tokenWithdrawal, recipient)

    assertChannelStateEqual(withdrawal as ChannelState, {
      recipient,
      balanceTokenHub: 0,
      balanceTokenUser: balanceTokenUser.toFixed(),
      balanceWeiHub: 0,
      balanceWeiUser: balanceWeiUser.minus(weiWithdrawal).toFixed(),
      pendingDepositTokenHub: balanceWeiUser.minus(weiWithdrawal).mul(mockRate).toFixed(),
      pendingDepositTokenUser: 0,
      pendingDepositWeiHub: 0,
      pendingDepositWeiUser: 0,
      pendingWithdrawalTokenHub: 0,
      pendingWithdrawalTokenUser: 0,
      pendingWithdrawalWeiUser: weiToUserWithdraw.toFixed(),
      pendingWithdrawalWeiHub: 0
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
    assertChannelStateEqual(
      syncUpdates[0].state.state as ChannelState,
      channelState,
    )
    assertThreadStateEqual(syncUpdates[1].state.state as ThreadState, {
      ...threadState,
      threadId: threadState.threadId,
    })
  })
})
