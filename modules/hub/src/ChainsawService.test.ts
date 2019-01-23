import {TestServiceRegistry, getTestRegistry } from './testing'
import ChainsawService from './ChainsawService'
import ChainsawDao, {PostgresChainsawDao} from './dao/ChainsawDao'
import DBEngine from './DBEngine'
import ChannelsDao, {PostgresChannelsDao} from './dao/ChannelsDao'
import {ChannelManager} from './ChannelManager'
import ABI, {BYTECODE} from './abi/ChannelManager'
import {assert} from 'chai'
import * as sinon from 'sinon'
import {Utils, emptyRootHash} from './vendor/client/Utils'
import {PgPoolServiceForTest} from './testing/mocks'
import {BigNumber} from 'bignumber.js'
import { ChannelState, PaymentArgs, DepositArgs, convertChannelState, ChannelStateBigNumber } from './vendor/client/types';
import { StateGenerator } from './vendor/client/StateGenerator'

const GAS_PRICE = '1000000000'

describe.skip('ChainsawService', function() {
  this.timeout(10000)

  let registry: TestServiceRegistry
  let clock: sinon.SinonFakeTimers

  let csDao: ChainsawDao
  let chanDao: ChannelsDao
  let utils: Utils
  let contract: ChannelManager
  let w3: any
  let cs: ChainsawService

  let HUB_ADDRESS: string
  let USER_ADDRESS: string
  let CM_ADDRESS: string

  before(async () => {
    w3 = getTestRegistry().get('Web3')
    clock = sinon.useFakeTimers()
    const accounts = await w3.eth.getAccounts()
    HUB_ADDRESS = accounts[0]
    USER_ADDRESS = accounts[1]

    contract = new w3.eth.Contract(ABI) as ChannelManager
    //const res = await contract.deploy({
    //  data: BYTECODE,
    //  arguments: [HUB_ADDRESS, '0x100', '0xd01c08c7180eae392265d8c7df311cf5a93f1b73']
    //}).send({
    //  from: HUB_ADDRESS,
    //  gas: 6721975,
    //  gasPrice: GAS_PRICE
    //})

    CM_ADDRESS = '0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42'
    contract = new w3.eth.Contract(ABI, CM_ADDRESS)

    registry = getTestRegistry({
      hotWalletAddress: HUB_ADDRESS,
      channelManagerAddress: CM_ADDRESS
    })
    csDao = registry.get('ChainsawDao')
    chanDao = registry.get('ChannelsDao')
    utils = registry.get('ConnextUtils')
    cs = registry.get('ChainsawService')
  })

  before(async () => {
    await registry.clearDatabase()
  })

  after(async () => {
    clock.restore()
  })

  it('should poll on startup and record high water mark', async () => {
    // kick off polling here
    const startBlock = await w3.eth.getBlockNumber()
    await cs.pollOnce()
    const lastEvent = await csDao.lastPollFor(CM_ADDRESS, 'FETCH_EVENTS')
    assert.equal(lastEvent.blockNumber, startBlock - 1)
  })

  it('should poll every second', async () => {
    const start = await csDao.lastPollFor(CM_ADDRESS, 'FETCH_EVENTS')
    await mine(5)
    const afterMined = await csDao.lastPollFor(CM_ADDRESS, 'FETCH_EVENTS')
    assert.equal(start.blockNumber, afterMined.blockNumber)
    await cs.pollOnce()
    const topBlock = await w3.eth.getBlockNumber()
    const afterTime = await csDao.lastPollFor(CM_ADDRESS, 'FETCH_EVENTS')
    assert.equal(afterTime.blockNumber, topBlock - 1)
  })

  describe('when a deposit is broadcast', () => {
    before(async () => {
      const state = await chanDao.getChannelOrInitialState(USER_ADDRESS)
      const fingerprint = utils.createChannelStateHash(convertChannelState('str-unsigned', state.state))
      const sigHub = await w3.eth.sign(fingerprint, HUB_ADDRESS)
      await contract.methods.userAuthorizedUpdate(
        USER_ADDRESS,
        ['0', '0'],
        ['0', '0'],
        ['0', '0', '100', '0'],
        ['0', '0', '0', '0'],
        [1, 1],
        emptyRootHash,
        0,
        0,
        sigHub
      ).send({
        from: USER_ADDRESS,
        gasPrice: GAS_PRICE,
        gas: 1000000,
        value: '100'
      })

      // confirmations
      await mine(2)
      await cs.pollOnce()
    })

    it('should persist that channel', async () => {
      const chan = await chanDao.getChannelByUser(USER_ADDRESS)
      assert.isTrue(chan.state.balanceWeiUser.eq(100))
      assert.isTrue(chan.state.balanceWeiHub.eq(0))
      assert.equal(chan.state.txCountChain, 1)
      assert.equal(chan.state.txCountGlobal, 2)
    })

    it('should write a new state update to the DB', async () => {
      const update = await chanDao.getChannelUpdateByTxCount(USER_ADDRESS, 2)
      assert.isNotNull(update)
      // 132 for len to account for 0x
      assert.equal(update.state.sigHub.length, 132)
    })
  })

  describe('off-chain updates followed by an on-chain update', async () => {
    let depositRes

    before(async () => {
      // start by countersigning the previous state
      const update = await chanDao.getChannelByUser(USER_ADDRESS)
      const fingerprint = utils.createChannelStateHash(convertChannelState('str', update.state))
      const sigUser = await w3.eth.sign(fingerprint, USER_ADDRESS)
      update.state.sigUser = sigUser
      await chanDao.applyUpdateByUser(USER_ADDRESS, 'Payment', USER_ADDRESS, convertChannelState('str', update.state), {} as PaymentArgs)

      // now send a couple of payment updates
      let next = update.state
      let builder
      let signed
      for (let i = 0; i < 3; i++) {
        builder = new StateUpdateBuilder(w3, utils, CM_ADDRESS, HUB_ADDRESS, next)
        builder.payWei('hub', '1')
        signed = await builder.countersign(false)
        // TODO
        await chanDao.applyUpdateByUser(USER_ADDRESS, 'Payment', USER_ADDRESS, signed.str, {} as PaymentArgs)
        next = signed.bn
      }

      // now perform a deposit
      builder = new StateUpdateBuilder(w3, utils, CM_ADDRESS, HUB_ADDRESS, next)
      builder.deposit('user', '100')
      signed = await builder.countersign(true)
      // TODO
      await chanDao.applyUpdateByUser(USER_ADDRESS, 'ProposePendingDeposit', USER_ADDRESS, signed.str, {} as DepositArgs)
      const deposit = signed.str
      next = signed.str

      // do another payment
      builder = new StateUpdateBuilder(w3, utils, CM_ADDRESS, HUB_ADDRESS, next)
      builder.payWei('hub', '7')
      signed = await builder.countersign(false)
      // TODO
      await chanDao.applyUpdateByUser(USER_ADDRESS, 'Payment', USER_ADDRESS, signed.str, {} as PaymentArgs)

      // now broadcast on-chain
      depositRes = await contract.methods.userAuthorizedUpdate(
        USER_ADDRESS,
        [deposit.balanceWeiHub, deposit.balanceWeiUser],
        [deposit.balanceTokenHub, deposit.balanceTokenUser],
        [deposit.pendingDepositWeiHub, deposit.pendingWithdrawalWeiHub, deposit.pendingDepositWeiUser, deposit.pendingDepositWeiHub],
        [deposit.pendingDepositTokenHub, deposit.pendingWithdrawalTokenHub, deposit.pendingDepositTokenUser, deposit.pendingDepositTokenHub],
        [deposit.txCountGlobal, deposit.txCountChain],
        deposit.threadRoot,
        deposit.threadCount,
        deposit.timeout,
        deposit.sigHub
      ).send({
        from: USER_ADDRESS,
        gasPrice: GAS_PRICE,
        gas: 1000000,
        value: '100'
      })

      await mine(2)
      await cs.pollOnce()
    })

    it('should persist the update to the database', async () => {
      const lastState = await chanDao.getChannelByUser(USER_ADDRESS)
      assert.equal(lastState.state.txCountChain, 2);
      assert.equal(lastState.state.txCountGlobal, 8);
      // matches the initial deposit, the payments, and the additional deposit above
      assert.isTrue(lastState.state.balanceWeiUser.eq(100 - 3 + 100 - 7))
      assert.isTrue(lastState.state.balanceWeiHub.eq(10))
      assert.isTrue(lastState.state.pendingDepositWeiHub.eq(0))
      assert.isTrue(lastState.state.pendingDepositWeiUser.eq(0))
      assert.isTrue(lastState.state.pendingWithdrawalWeiHub.eq(0))
      assert.isTrue(lastState.state.pendingWithdrawalWeiUser.eq(0))
    })

    it('should record the high water mark', async () => {
      const last = await csDao.lastPollFor(CM_ADDRESS, 'PROCESS_EVENTS')
      assert.equal(last.txIndex, depositRes.transactionIndex)
      assert.equal(last.blockNumber, depositRes.blockNumber)
    })
  })

  async function mine (num: number = 1) {
    for (let i = 0; i < num; i++) {
      await new Promise((resolve, reject) => w3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [],
        id: Date.now()
      }, (err, res) => {
        if (err) {
          return reject()
        }

        resolve(res)
      }))
    }
  }

})

class StateUpdateBuilder {
  private w3: any
  private hubAddress: string
  private state: ChannelStateBigNumber
  private utils: Utils

  constructor (w3: any, utils: Utils, contractAddress: string, hubAddress: string, update?: ChannelStateBigNumber) {
    this.w3 = w3
    this.hubAddress = hubAddress.toLowerCase()
    this.utils = utils
    this.state = {
      contractAddress: contractAddress.toLowerCase(),
      user: update ? update.user.toLowerCase() : '',
      recipient: update ? update.recipient.toLowerCase() : '',
      balanceWeiHub: new BigNumber(update ? update.balanceWeiHub : 0),
      balanceWeiUser: new BigNumber(update ? update.balanceWeiUser : 0),
      balanceTokenHub: new BigNumber(update ? update.balanceTokenHub : 0),
      balanceTokenUser: new BigNumber(update ? update.balanceTokenUser : 0),
      pendingDepositWeiHub: new BigNumber(update ? update.pendingDepositWeiHub : 0),
      pendingDepositWeiUser: new BigNumber(update ? update.pendingDepositWeiUser : 0),
      pendingDepositTokenHub: new BigNumber(update ? update.pendingDepositTokenHub : 0),
      pendingDepositTokenUser: new BigNumber(update ? update.pendingDepositTokenUser : 0),
      pendingWithdrawalWeiHub: new BigNumber(update ? update.pendingWithdrawalWeiHub : 0),
      pendingWithdrawalWeiUser: new BigNumber(update ? update.pendingWithdrawalWeiUser : 0),
      pendingWithdrawalTokenHub: new BigNumber(update ? update.pendingWithdrawalTokenHub : 0),
      pendingWithdrawalTokenUser: new BigNumber(update ? update.pendingWithdrawalTokenUser : 0),
      txCountGlobal: update? update.txCountGlobal : 1,
      txCountChain: update ? update.txCountChain : 1,
      threadRoot: update ? update.threadRoot : emptyRootHash,
      threadCount: update ? update.threadCount : 0,
      timeout: update ? update.timeout : 0,
      sigHub: '',
      sigUser: ''
    }
  }

  payWei (to: 'hub'|'user', amount: BigNumber|string|number): StateUpdateBuilder {
    let balUser
    let balHub

    if (to === 'hub') {
      balUser = this.state.balanceWeiUser.minus(amount)
      balHub = this.state.balanceWeiHub.plus(amount)
    } else {
      balUser = this.state.balanceWeiUser.plus(amount)
      balHub = this.state.balanceWeiHub.minus(amount)
    }

    if (balUser.isNeg() || balHub.isNeg()) {
      throw new Error('transferring too much')
    }

    this.state.balanceWeiUser = balUser
    this.state.balanceWeiHub = balHub

    return this
  }

  deposit(to: 'hub'|'user', amount: BigNumber|string|number): StateUpdateBuilder {
    if (to === 'hub') {
      this.state.pendingDepositWeiHub = this.state.pendingDepositWeiHub.plus(amount)
    } else {
      this.state.pendingDepositWeiUser = this.state.pendingDepositWeiUser.plus(amount)
    }

    return this
  }

  withdraw (from: 'hub'|'user', amount: BigNumber|string|number): StateUpdateBuilder {
    let bal

    if (from === 'hub') {
      bal = this.state.balanceWeiHub.minus(amount)
    } else {
      bal = this.state.balanceWeiUser.plus(amount)
    }

    if (bal.isNeg()) {
      throw new Error('transferring too much')
    }

    if (from === 'hub') {
      this.state.balanceWeiHub = bal
      this.state.pendingWithdrawalWeiHub = this.state.pendingWithdrawalWeiHub.plus(bal)
    } else {
      this.state.balanceWeiUser = bal
      this.state.pendingWithdrawalWeiUser = this.state.pendingWithdrawalWeiUser.plus(bal)
    }

    return this
  }

  async countersign(chain: boolean): Promise<{ bn: ChannelStateBigNumber, str: ChannelState }> {
    this.state.txCountGlobal++
    if (chain) {
      this.state.txCountChain++
    }
    const update = {
      contractAddress: this.state.contractAddress,
      user: this.state.user,
      recipient: this.state.recipient,
      balanceWeiHub: this.state.balanceWeiHub.toString(),
      balanceWeiUser: this.state.balanceWeiUser.toString(),
      balanceTokenHub: this.state.balanceTokenHub.toString(),
      balanceTokenUser: this.state.balanceTokenUser.toString(),
      pendingDepositWeiHub: this.state.pendingDepositWeiHub.toString(),
      pendingDepositWeiUser: this.state.pendingDepositWeiUser.toString(),
      pendingDepositTokenHub: this.state.pendingDepositTokenHub.toString(),
      pendingDepositTokenUser: this.state.pendingDepositTokenUser.toString(),
      pendingWithdrawalWeiHub: this.state.pendingWithdrawalWeiHub.toString(),
      pendingWithdrawalWeiUser: this.state.pendingWithdrawalWeiUser.toString(),
      pendingWithdrawalTokenHub: this.state.pendingWithdrawalTokenHub.toString(),
      pendingWithdrawalTokenUser: this.state.pendingWithdrawalTokenUser.toString(),
      txCountGlobal: this.state.txCountGlobal,
      txCountChain: this.state.txCountChain,
      threadRoot: this.state.threadRoot,
      threadCount: this.state.threadCount,
      timeout: this.state.timeout,
    }
    const fingerprint = this.utils.createChannelStateHash(update)
    this.state.sigUser = await this.w3.eth.sign(fingerprint, this.state.user)
    this.state.sigHub = await this.w3.eth.sign(fingerprint, this.hubAddress)
    const str = {
      ...this.state,
      balanceWeiHub: this.state.balanceWeiHub.toString(),
      balanceWeiUser: this.state.balanceWeiUser.toString(),
      balanceTokenHub: this.state.balanceTokenHub.toString(),
      balanceTokenUser: this.state.balanceTokenUser.toString(),
      pendingDepositWeiHub: this.state.pendingDepositWeiHub.toString(),
      pendingDepositWeiUser: this.state.pendingDepositWeiUser.toString(),
      pendingDepositTokenHub: this.state.pendingDepositTokenHub.toString(),
      pendingDepositTokenUser: this.state.pendingDepositTokenUser.toString(),
      pendingWithdrawalWeiHub: this.state.pendingWithdrawalWeiHub.toString(),
      pendingWithdrawalWeiUser: this.state.pendingWithdrawalWeiUser.toString(),
      pendingWithdrawalTokenHub: this.state.pendingWithdrawalTokenHub.toString(),
      pendingWithdrawalTokenUser: this.state.pendingWithdrawalTokenUser.toString(),
    }

    return {
      bn: {
        ...this.state,
      },
      str,
    }
  }
}
