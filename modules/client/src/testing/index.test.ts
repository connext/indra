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

describe('assertChannelStateEqual', () => {
  it('should work', () => {
    let state = t.getChannelState('full', {
      balanceWei: [100, 200],
    })

    t.assertChannelStateEqual(state, {
      balanceWeiHub: '100',
      balanceWeiUser: '200',
    })

    state = t.updateChannelState(state, {
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

    state = t.updateThreadState(state, {
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