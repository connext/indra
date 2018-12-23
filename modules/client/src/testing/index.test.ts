import * as t from './index'
import { assert } from './index'

describe('makeSuccinctChannel', () => {
  it('should work', () => {
    assert.deepEqual(
      t.makeSuccinctChannel({
        balanceWeiHub: '1',
        balanceWeiUser: '2',
        timeout: 69,
      }),
      {
        balanceWei: ['1', '2'],
        timeout: 69,
      },
    )
  })
})

describe('makeSuccinctThread', () => {
  it('should work', () => {
    assert.deepEqual(
      t.makeSuccinctThread({
        balanceWeiSender: '1',
        balanceWeiReceiver: '2',
      }),
      {
        balanceWei: ['1', '2'],
      },
    )
  })
})

describe('makeSuccinctExchange', () => {
  it('should work', () => {
    assert.deepEqual(
      t.makeSuccinctExchange({
        tokensToSell: '1',
        weiToSell: '2',
      }),
      {
        toSell: ['1', '2'],
      },
    )
  })
})

describe('expandSuccinctChannel', () => {
  it('should work', () => {
    assert.deepEqual(
      t.expandSuccinctChannel({
        balanceWei: ['1', '2'],
        timeout: 69,
      }),
      {
        balanceWeiHub: '1',
        balanceWeiUser: '2',
        timeout: 69,
      },
    )
  })
})

describe('expandSuccinctThread', () => {
  it('should work', () => {
    assert.deepEqual(
      t.expandSuccinctThread({
        balanceWei: ['1', '2'],
      }),
      {
        balanceWeiSender: '1',
        balanceWeiReceiver: '2',
      },
    )
  })
})

describe('expandSuccinctExchange', () => {
  it('should work', () => {
    assert.deepEqual(
      t.expandSuccinctExchangeArgs({
        toSell: ['1', '0'],
      }),
      {
        tokensToSell: '1',
        weiToSell: '0',
      },
    )
  })
})

describe('get pending', () => {
  it('should work', () => {
    let args = t.getPendingArgs("empty")

    assert.deepEqual(args, {
      withdrawalWeiUser: '0',
      withdrawalWeiHub: '0',
      withdrawalTokenUser: '0',
      withdrawalTokenHub: '0',
      depositTokenUser: '0',
      depositWeiUser: '0',
      depositWeiHub: '0',
      depositTokenHub: '0',
      recipient: t.mkAddress('0xRRR'),
      timeout: 0
    })

    args = t.getPendingArgs("empty", { recipient: t.mkAddress('0xDAD?') })

    assert.containSubset(args, { recipient: t.mkAddress('0xDAD?') })
  })
})

describe('assertChannelStateEqual', () => {
  it('should work', () => {
    let state = t.getChannelState('full', {
      balanceWei: [100, 200],
    })

    t.assertChannelStateEqual(state, {
      balanceWeiHub: '100',
      balanceWeiUser: '200',
    })

    state = t.updateObj("channel", state, {
      timeout: 69,
      balanceWeiUser: 42,
      balanceToken: [6, 9],
      txCount: [66, 99],
    })

    t.assertChannelStateEqual(state, {
      balanceWei: [100, 42],
      balanceTokenHub: '6',
      balanceTokenUser: '9',
      timeout: 69,
      txCountGlobal: 66,
      txCountChain: 99,
    })
  })
})

describe('assertThreadStateEqual', () => {
  it('should work', () => {
    let state = t.getThreadState('full', {
      balanceWei: [100, 200],
    })

    t.assertThreadStateEqual(state, {
      balanceWeiReceiver: '200',
      balanceWeiSender: '100',
    })

    state = t.updateObj("thread", state, {
      balanceWeiReceiver: 42,
      balanceToken: [6, 9],
      txCount: 66,
    })

    t.assertThreadStateEqual(state, {
      balanceWei: [100, 42],
      balanceTokenReceiver: '9',
      balanceTokenSender: '6',
      txCount: 66,
    })
  })
})