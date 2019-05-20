import { ethers as eth } from 'ethers'
import * as sinon from 'sinon'

import * as ChannelManagerAbi from './contract/ChannelManagerAbi.json'
import { toBN } from './lib/bn'
import * as t from './testing'
import {
  ChannelState,
  ChannelStateBN,
  convertArgs,
  convertChannelState,
  convertPayment,
  convertProposePending,
  convertThreadState,
  convertWithdrawal,
  ExchangeArgs,
  ExchangeArgsBN,
  Interface,
  InvalidationArgs,
  PaymentArgs,
  PaymentArgsBN,
  PendingArgs,
  PendingArgsBN,
  PendingExchangeArgsBN,
  proposePendingNumericArgs,
  Provider,
  ThreadState,
  UnsignedThreadState,
  WithdrawalArgsBN,
} from './types'
import { Utils } from './Utils'
import { Validator } from './validator'

const assert: any = t.assert
const sampleAddress: string = '0x0bfa016abfa8f627654b4989da4620271dc77b1c'
const sampleAddress2: string = '0x17b105bcb3f06b3098de6eed0497a3e36aa72471'
const sampleAddress3: string = '0x23a1e8118EA985bBDcb7c40DE227a9880a79cf7F'
const hubAddress: string = '0xFB482f8f779fd96A857f1486471524808B97452D'

const conditionFailure = (condition: string, field: string): string =>
  `There were ${condition} fields detected (detected fields and values: [{"field":"${field}"`

/* Overrides for these fns function must be in the contract format
as they are used in solidity decoding. Returns tx with default deposit
values of all 5s
*/
const createMockedWithdrawalTxReceipt = (
  sender: 'user' | 'hub',
  abi: Interface,
  ...overrides: any[]
): any => {
  const vals: any = generateTransactionReceiptValues({
    pendingTokenUpdates: ['0', '5', '0', '5'],
    pendingWeiUpdates: ['0', '5', '0', '5'],
    senderIdx: sender === 'user' ? '1' : '0', // default to user wei deposit 5
  }, overrides)
  return createMockedTransactionReceipt(abi, vals)
}

const createMockedDepositTxReceipt = (
  sender: 'user' | 'hub',
  abi: Interface,
  ...overrides: any[]
): any => {
  const vals: any = generateTransactionReceiptValues({
    pendingTokenUpdates: ['5', '0', '5', '0'],
    pendingWeiUpdates: ['5', '0', '5', '0'],
    senderIdx: sender === 'user' ? '1' : '0', // default to user wei deposit 5
  }, overrides)
  return createMockedTransactionReceipt(abi, vals)
}

const generateTransactionReceiptValues = (...overrides: any[]): any => Object.assign({
  pendingTokenUpdates: ['0', '0', '0', '0'],
  pendingWeiUpdates: ['0', '0', '0', '0'],
  senderIdx: '1', // default to user wei deposit 5
  threadCount: '0',
  threadRoot: eth.constants.HashZero,
  tokenBalances: ['0', '0'],
  txCount: ['1', '1'],
  user: sampleAddress,
  weiBalances: ['0', '0'],
}, ...overrides)


const createMockedTransactionReceipt = (abi: Interface, vals: any): any => {
  // console.log(`creating tx receipt from vals: ${JSON.stringify(vals,undefined,2)}`)
  const eventTopic: string = abi.events.DidUpdateChannel.topic
  const addrTopic: any = eth.utils.defaultAbiCoder.encode(['address'], [vals.user])
  const data: any = eth.utils.defaultAbiCoder.encode(
    abi.events.DidUpdateChannel.inputs,
    [
      vals.user,
      vals.senderIdx,
      vals.weiBalances,
      vals.tokenBalances,
      vals.pendingWeiUpdates,
      vals.pendingTokenUpdates,
      vals.txCount,
      vals.threadRoot,
      vals.threadCount,
    ],
  )
  const logs = [{
    data: eth.utils.hexlify(data),
    topics: [eventTopic, addrTopic],
  }]

  // console.log(`Created logs w pending wei update: ${
  //   JSON.stringify(abi.parseLog(logs[0]).pendingWeiUpdates)}`)

  return {
    contractAddress: t.mkAddress('0xCCC'),
    logs: [{
      data: eth.utils.hexlify(data),
      topics: [eventTopic, addrTopic],
    }],
    status: true,
    transactionHash: t.mkHash('0xHHH'),
  }
}

const createPreviousChannelState = (...overrides: t.PartialSignedOrSuccinctChannel[]): any => {
  const state: any = t.getChannelState('empty', Object.assign({
    sigHub: t.mkHash('errywhere'),
    sigUser: t.mkHash('booty'),
    user: sampleAddress,
  }, ...overrides))
  return convertChannelState('bn', state)
}

const createThreadPaymentArgs = (...overrides: Array<Partial<PaymentArgs<any>>>): any => {
  const { recipient, ...amts }: any = createPaymentArgs(...overrides)
  return amts
}

const createPaymentArgs = (
  ...overrides: Array<Partial<PaymentArgs<any>>>
): PaymentArgsBN => {
  const args: any = Object.assign({
    amountToken: '0',
    amountWei: '0',
    recipient: 'user',
  }, ...overrides) as any
  return convertPayment('bn', { ...convertPayment('str', args) })
}

const createProposePendingArgs = (overrides?: Partial<PendingArgs<number>>): PendingArgsBN => {
  const res: any = {
    recipient: '0x1234',
    timeout: 0,
  }
  proposePendingNumericArgs.forEach((a: string) => (res as any)[a] = 0)
  return convertProposePending('bn', {
    ...res,
    ...(overrides || {}),
  })
}

const createThreadState = (...overrides: t.PartialSignedOrSuccinctThread[]): any => {
  const opts: any = Object.assign({}, ...overrides)
  const thread: any = t.getThreadState('empty', {
    balanceToken: [5, 0],
    balanceWei: [5, 0],
    receiver: t.mkAddress('0xAAA'),
    sender: sampleAddress,
    sigA: t.mkHash('0xtipz'),
    ...opts,
  })
  return convertThreadState('bn', thread)
}

/*
 Use this function to create an arbitrary number of thread states as indicated by the
 targetThreadCount parameter. Override each thread state that gets returned with provided
 override arguments. Example usage and output:
 > createChannelThreadOverrides(2, { threadId: 87, receiver: t.mkAddress('0xAAA') })
 > { threadCount: 2,
  initialThreadStates:
   [ { contractAddress: '0xCCC0000000000000000000000000000000000000',
       sender: '0x0bfA016aBFa8f627654b4989DA4620271dc77b1C',
       receiver: '0xAAA0000000000000000000000000000000000000',
       threadId: 87,
       balanceWeiSender: '5',
       balanceWeiReceiver: '0',
       balanceTokenSender: '5',
       balanceTokenReceiver: '0',
       txCount: 0 },
     { contractAddress: '0xCCC0000000000000000000000000000000000000',
       sender: '0x0bfA016aBFa8f627654b4989DA4620271dc77b1C',
       receiver: '0xAAA0000000000000000000000000000000000000',
       threadId: 87,
       balanceWeiSender: '5',
       balanceWeiReceiver: '0',
       balanceTokenSender: '5',
       balanceTokenReceiver: '0',
       txCount: 0 } ],
  threadRoot: '0xbb97e9652a4754f4e543a7ed79b654dc5e5914060451f5d87e0b9ab1bde73bef' }
 */

const createChannelThreadOverrides = (targetThreadCount: number, ...overrides: any[]): any => {
  const utils: Utils = new Utils()
  if (!targetThreadCount) {
    return {
      initialThreadStates: [],
      threadCount: 0,
      threadRoot: eth.constants.HashZero,
    }
  }
  const initialThreadStates: ThreadState[] = [] as ThreadState[]
  for (let i: number = 0; i < targetThreadCount; i += 1) {
    initialThreadStates.push(convertThreadState('str', createThreadState(Object.assign({
      receiver: t.mkAddress(`0x${i + 1}`),
      threadId: i + 69,
      txCount: 0,
    }, ...overrides),
    )))
  }
  return {
    initialThreadStates,
    threadCount: targetThreadCount,
    threadRoot: utils.generateThreadRootHash(initialThreadStates),
  }
}

describe('validator', () => {
  const provider: Provider = new eth.providers.JsonRpcProvider('http://localhost:8545')
  const abi: Interface = new eth.utils.Interface(ChannelManagerAbi.abi)
  const validator: Validator = new Validator(hubAddress, provider, ChannelManagerAbi.abi)

  describe('channelPayment', () => {
    const prev = createPreviousChannelState({
      balanceToken: [5, 5],
      balanceWei: [5, 5],
    })

    for (const tc of [
      {
        args: createPaymentArgs({
          amountToken: 1,
          amountWei: '1',
        }),
        name: 'should pass if given a valid hub to user payment',
        valid: true,
      },
      {
        args: createPaymentArgs({ recipient: 'hub' }),
        name: 'should pass if given a valid user to hub payment',
        valid: true,
      },
      {
        args: createPaymentArgs({ amountToken: -1, amountWei: -1 }),
        name: 'should fail if payment args are negative',
        valid: false,
      },
      {
        args: createPaymentArgs({ amountToken: 10, amountWei: 10 }),
        name: 'should fail if payment exceeds available channel balance',
        valid: false,
      },
    ]) {

      it(tc.name, () => {
        if (tc.valid) {
          assert.isUndefined(validator.channelPayment(prev, tc.args))
        } else {
          assert.exists(validator.channelPayment(prev, tc.args))
        }
      })
    }

  })

  const getExchangeCases = (): any => {
    const prev = createPreviousChannelState({
      balanceToken: [5, 5],
      balanceWei: [5, 5],
    })

    const baseWeiToToken = {
      exchangeRate: '5',
      seller: 'user',
      tokensToSell: toBN(0),
      weiToSell: toBN(1),
    }

    const baseTokenToWei = {
      exchangeRate: '5',
      seller: 'user',
      tokensToSell: toBN(5),
      weiToSell: toBN(0),
    }

    return [
      {
        args: baseTokenToWei,
        name: 'should pass if valid token for wei exchange seller is user',
        prev,
        valid: true,
      },
      {
        args: { ...baseTokenToWei, seller: 'hub' },
        name: 'should pass if valid token for wei exchange seller is hub',
        prev,
        valid: true,
      },
      {
        args: baseWeiToToken,
        name: 'should pass if valid wei for token exchange seller is user',
        prev,
        valid: true,
      },
      {
        args: { ...baseWeiToToken, seller: 'hub' },
        name: 'should pass if valid wei for token exchange seller is user',
        prev,
        valid: true,
      },
      {
        args: { ...baseWeiToToken, weiToSell: toBN(0) },
        name: 'should fail if both toSell values are zero',
        prev,
        valid: false,
      },
      {
        args: { ...baseWeiToToken, tokensToSell: toBN(1) },
        name: 'should fail if neither toSell values are zero',
        prev,
        valid: false,
      },
      {
        args: { ...baseWeiToToken, weiToSell: toBN(-5) },
        name: 'should fail if negative wei to sell is provided',
        prev,
        valid: false,
      },
      {
        args: { ...baseTokenToWei, tokensToSell: toBN(-5) },
        name: 'should fail if negative tokens to sell is provided',
        prev,
        valid: false,
      },
      {
        args: { ...baseTokenToWei, tokensToSell: toBN(10) },
        name: 'should fail if seller cannot afford tokens for wei exchange',
        prev,
        valid: false,
      },
      {
        args: { ...baseWeiToToken, weiToSell: toBN(10) },
        name: 'should fail if seller cannot afford wei for tokens exchange',
        prev,
        valid: false,
      },
      {
        args: { ...baseWeiToToken, weiToSell: toBN(2) },
        name: 'should fail if payor cannot afford wei for tokens exchange',
        prev,
        valid: false,
      },
      {
        args: { ...baseTokenToWei, weiToSell: toBN(10) },
        name: 'should fail if payor as hub cannot afford tokens for wei exchange',
        prev: { ...prev, balanceWeiHub: toBN(0) },
        valid: false,
      },
      {
        args: { ...baseTokenToWei, weiToSell: toBN(10), seller: 'user' },
        name: 'should fail if payor as user cannot afford tokens for wei exchange',
        prev: { ...prev, balanceWeiUser: toBN(0) },
        valid: false,
      },
    ]
  }

  describe('exchange', () => {
    getExchangeCases().forEach(({ name, prev, args, valid }: any) => {
      it(name, () => {
        if (valid) {
          assert.isUndefined(validator.exchange(prev, args as ExchangeArgsBN))
        } else {
          assert.exists(validator.exchange(prev, args as ExchangeArgsBN))
        }
      })
    })
  })

  describe('proposePendingDeposit', () => {
    const prev = createPreviousChannelState({
      balanceToken: [5, 5],
      balanceWei: [5, 5],
    })
    const args = {
      depositTokenHub: toBN(1),
      depositTokenUser: toBN(1),
      depositWeiHub: toBN(1),
      depositWeiUser: toBN(1),
      timeout: 6969,
    }

    for (const tc of [
      {
        args,
        name: 'should work',
        prev,
        valid: true,
      },
      {
        args,
        name: 'should fail if pending operations exist on the previous state',
        prev: { ...prev, pendingDepositWeiUser: toBN(5) },
        valid: false,
      },
      {
        args: { ...args, depositWeiUser: toBN(-5) },
        name: 'should fail for negative deposits',
        prev,
        valid: false,
      },
      {
        args: { ...args, timeout: 0 },
        name: 'should fail if 0 timeout provided',
        prev,
        valid: true,
      },
      {
        args: { ...args, timeout: -5 },
        name: 'should fail if negative timeout provided',
        prev,
        valid: false,
      },
    ]) {

      it(tc.name, () => {
        if (tc.valid) {
          assert.isUndefined(validator.proposePendingDeposit(tc.prev, tc.args))
        } else {
          assert.exists(validator.proposePendingDeposit(tc.prev, tc.args))
        }
      })

    }
  })

  describe('proposePendingWithdrawal', () => {
    const prev: ChannelStateBN = createPreviousChannelState({
      balanceToken: [5, 10],
      balanceWei: [10, 5],
    })
    const args: WithdrawalArgsBN = convertWithdrawal('bn', t.getWithdrawalArgs('empty', {
      exchangeRate: '2',
      targetWeiHub: 5,
      targetWeiUser: 0,
      tokensToSell: 10,
    }))

    for (const tc of [
      {
        args,
        name: 'should work',
        prev,
        valid: true,
      },
      {
        args,
        name: 'should fail if there are pending ops in prev',
        prev: { ...prev, pendingDepositWeiUser: toBN(10) },
        valid: false,
      },
      {
        args: { ...args, weiToSell: toBN(-5) },
        name: 'should fail if the args have a negative value',
        prev,
        valid: false,
      },
      {
        args: { ...args, tokensToSell: toBN(20) },
        name: 'should fail if resulting state has negative values',
        prev,
        valid: false,
      },
      {
        args: {
          ...args, additionalWeiHubToUser: toBN(30), tokensToSell: toBN(0), weiToSell: toBN(10),
        },
        name: 'should fail if the args result in an invalid transition',
        prev,
        valid: false,
      },
      // TODO: find out which args may result in this state from the
      // withdrawal function (if any) from wolever
      // {
      //   name: 'should fail if hub collateralizes an exchange and withdraws',
      //   prev,
      //   args: '',
      //   valid: false
      // },
    ]) {

      it(tc.name, () => {
        const res = validator.proposePendingWithdrawal(tc.prev, tc.args)
        if (tc.valid) {
          assert.isUndefined(res)
        } else {
          assert.exists(res)
        }
      })

    }
  })

  describe('confirmPending', () => {
    const depositReceipt: any = createMockedDepositTxReceipt('user', abi)
    const wdReceipt: any = createMockedWithdrawalTxReceipt('user', abi)

    const prevDeposit: any = createPreviousChannelState({
      pendingDepositToken: [5, 5],
      pendingDepositWei: [5, 5],
    })

    const prevWd: any = createPreviousChannelState({
      pendingWithdrawalToken: [5, 5],
      pendingWithdrawalWei: [5, 5],
    })

    const tx: any = {
      blockHash: t.mkHash('0xBBB'),
      to: prevDeposit.contractAddress,
    }

    for (const tc of [
      {
        name: 'should work for deposits',
        prev: prevDeposit,
        stubs: [tx, depositReceipt],
        valid: true,
      },
      /*
      {
        name: 'should work for withdrawals',
        prev: prevWd,
        stubs: [tx, wdReceipt],
        valid: true,
      },
      {
        name: 'should work depsite casing differences',
        prev: {
          ...prevDeposit,
          user: prevDeposit.user.toUpperCase(),
          recipient: prevDeposit.user.toUpperCase(),
        },
        stubs: [tx, depositReceipt],
        valid: true,
      },
      {
        name: 'should fail if no transaction is found with that hash',
        prev: prevWd,
        stubs: [undefined, depositReceipt],
        valid: false,
      },
      {
        name: 'should fail if transaction is not sent to contract',
        prev: prevDeposit,
        stubs: [{ ...tx, to: t.mkAddress('0xfail') }, depositReceipt],
        valid: false,
      },
      {
        name: 'should fail if transaction is not sent by participants',
        prev: { ...prevDeposit, user: t.mkAddress('0xUUU'), },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should fail if user is not same in receipt and previous',
        prev: { ...prevDeposit, user: t.mkAddress('0xUUU'), },
        stubs: [tx, createMockedDepositTxReceipt("hub", abi)],
        valid: false,
      },
      // {
      //   name: 'should fail if balance wei hub is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceWeiHub: toBN(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should fail if balance wei user is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceWeiUser: toBN(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should fail if balance token hub is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceTokenHub: toBN(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should fail if balance token user is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceTokenUser: toBN(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      {
        name: 'should fail if pending deposit wei hub is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositWeiHub: toBN(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should fail if pending deposit wei user is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositWeiUser: toBN(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should fail if pending deposit token hub is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositTokenHub: toBN(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should fail if pending deposit token user is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositTokenUser: toBN(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should fail if pending withdrawal wei hub is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalWeiHub: toBN(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should fail if pending withdrawal wei user is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalWeiUser: toBN(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should fail if pending withdrawal token hub is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalTokenHub: toBN(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should fail if pending withdrawal token user is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalTokenUser: toBN(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      // {
      //   name: 'should fail if tx count global is not same in receipt and previous',
      //   prev: { ...prevDeposit, txCountGlobal: 7 },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      {
        name: 'should fail if tx count chain is not same in receipt and previous',
        prev: { ...prevDeposit, txCountChain: 7 },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      // {
      //   name: 'should fail if thread root is not same in receipt and previous',
      //   prev: { ...prevDeposit, threadRoot: t.mkHash('0xROOTZ') },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should fail if thread count is not same in receipt and previous',
      //   prev: { ...prevDeposit, threadCount: 7 },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      */
    ]) {

      it.skip(tc.name, async () => {
        // set tx receipt stub
        validator.provider.getTransaction = sinon.stub().returns(tc.stubs[0])
        validator.provider.getTransactionReceipt = sinon.stub().returns(tc.stubs[1])
        // console.log(`comparing event to prev`)
        // console.log(`event logs: ${JSON.stringify(abi.parseLog(stubs[1][0]),undefined,2)}`)
        // console.log(`prev: ${JSON.stringify(prev,undefined,2)}`)
        // set args
        const transactionHash: string = depositReceipt.transactionHash
          // (stubs[1] && (stubs[1] as any).transactionHash === depositReceipt.transactionHash)
          //   ? depositReceipt.transactionHash
          //   : wdReceipt.transactionHash
        if (tc.valid) {
          assert.isUndefined(await validator.confirmPending(tc.prev, { transactionHash }))
        } else {
          assert.exists(await validator.confirmPending(tc.prev, { transactionHash }))
        }
      })

    }
  })

  describe('invalidation', () => {
    const prev = createPreviousChannelState({
      txCount: [1, 1],
    })

    const args: InvalidationArgs = {
      lastInvalidTxCount: prev.txCountGlobal + 1,
      previousValidTxCount: prev.txCountGlobal,
      reason: 'CU_INVALID_ERROR',
    }

    for (const tc of [
      {
        args,
        name: 'should work',
        prev,
        valid: true,
      },
      {
        args: { ...args, previousValidTxCount: 3 },
        name: 'should fail if previous nonce is higher than nonce to be invalidated',
        prev,
        valid: false,
      },
      {
        args: { ...args, previousValidTxCount: 3, lastInvalidTxCount: 3 },
        name: 'should fail if previous state nonce and nonce in args do not match',
        prev: { ...prev, txCountGlobal: 5 },
        valid: false,
      },
      {
        args,
        name: 'should fail if previous state has pending ops',
        prev: { ...prev, pendingDepositWeiUser: toBN(5) },
        valid: false,
      },
      {
        args,
        name: 'should fail if previous state is missing sigHub',
        prev: { ...prev, sigHub: '' },
        valid: false,
      },
      {
        args,
        name: 'should fail if previous state is missing sigUser',
        prev: { ...prev, sigUser: '' },
        valid: false,
      },
    ]) {

      it(tc.name, () => {
        if (tc.valid) {
          assert.isUndefined(validator.invalidation(tc.prev, tc.args))
        } else {
          assert.exists(validator.invalidation(tc.prev, tc.args))
        }
      })

    }
  })

  ////////////////////////////////////////
  // Should test success of the following cases:
  // 1. Should work with first thread
  // 2. Should work with subsequent threads
  // Should test failures of the following cases:
  // 1. User must be sender or receiver
  // 2. Receiver wei balance must be zero for thread state
  // 3. Receiver token balance must be zero for thread state
  // 4. Sender cannot be receiver
  // 5. Sender or receiver cannot be hub
  // 6. Sender or receiver cannot be channel manager
  // 7. Incorrect signature or signer (not signed by sender or wrong payload)
  // 8. Thread root must be correct on previous state
  // 9. Thread count must be correct on previous state
  // 10. TxCount must be zero
  // 11. Contract address must be consistent with channel
  // 12. Sender or hub has sufficient funds
  // 13. Sender wei balance must be not negative
  // 14. Sender token balance must be not negative
  // 15. TxCount must not be negative
  // 16. Sender, receiver, contract all have valid addresses
  // 17. Sender or receiver is channel user
  // 18. Previous state has signature
  describe('validator.openThread', () => {
    const { initialThreadStates, threadRoot, threadCount } = createChannelThreadOverrides(2)
    const prev = createPreviousChannelState({
      balanceToken: [10, 10],
      balanceWei: [10, 10],
      threadCount,
      threadRoot,
    })

    const defaultArgs = createThreadState()

    for (const tc of [
      {
        args: defaultArgs,
        initialThreadStates: [],
        message: undefined,
        name: 'should pass with first thread',
        prev: { ...prev, threadRoot: eth.constants.HashZero, threadCount: 0 },
        sigErr: false,
      },
      {
        args: defaultArgs,
        initialThreadStates,
        message: undefined,
        name: 'should pass for additional threads',
        prev,
        sigErr: false,
      },
      {
        args: {...defaultArgs, sender: t.mkAddress('0xA11')},
        initialThreadStates,
        message: 'Channel user is not a member of this thread state.',
        name: 'should fail if user is not either sender or receiver',
        prev,
        sigErr: false,
      },
      {
        args: { ...defaultArgs, balanceWeiReceiver: toBN(2) },
        initialThreadStates,
        message: conditionFailure('1 non-zero', 'balanceWeiReceiver'),
        name: 'should fail if the receiver wei balance is greater than zero',
        prev,
        sigErr: false,
      },
      {
        args: { ...defaultArgs, balanceTokenReceiver: toBN(2) },
        initialThreadStates,
        message: conditionFailure('1 non-zero', 'balanceTokenReceiver'),
        name: 'should fail if the receiver token balance is greater than zero',
        prev,
        sigErr: false,
      },
      {
        args: { ...defaultArgs, balanceWeiReceiver: toBN(-2) },
        initialThreadStates,
        message: conditionFailure('1 non-zero', 'balanceWeiReceiver'),
        name: 'should fail if the receiver wei balance is less than zero',
        prev,
        sigErr: false,
      },
      {
        args: { ...defaultArgs, balanceTokenReceiver: toBN(-2) },
        initialThreadStates,
        message: conditionFailure('1 non-zero', 'balanceTokenReceiver'),
        name: 'should fail if the receiver token balance is less than zero',
        prev,
        sigErr: false,
      },
      {
        args: {...defaultArgs, receiver: sampleAddress },
        initialThreadStates,
        message: 'Sender cannot be receiver.',
        name: 'should fail if the sender is the receiver',
        prev,
        sigErr: false,
      },
      {
        args: { ...defaultArgs, sender: hubAddress, receiver: sampleAddress },
        initialThreadStates,
        message: 'Sender cannot be hub',
        name: 'should fail if sender is hub',
        prev,
        sigErr: false,
      },
      {
        args: {...defaultArgs, receiver: hubAddress },
        initialThreadStates,
        message: 'Receiver cannot be hub',
        name: 'should fail if receiver is hub',
        prev,
        sigErr: false,
      },
      {
        args: {...defaultArgs, sender: prev.contractAddress, receiver: sampleAddress },
        initialThreadStates,
        message: 'Sender cannot be contract',
        name: 'should fail if sender is channel manager',
        prev,
        sigErr: false,
      },
      {
        args: {...defaultArgs, receiver: prev.contractAddress},
        initialThreadStates,
        message: 'Receiver cannot be contract',
        name: 'should fail if receiver is channel manager',
        prev,
        sigErr: false,
      },
      {
        args: defaultArgs,
        initialThreadStates,
        message: 'Incorrect signer',
        name: 'should fail if an incorrect signer is detected',
        prev,
        sigErr: true,
      },
      {
        args: defaultArgs,
        initialThreadStates,
        message: 'Initial thread states not contained in previous state root hash',
        name: 'should fail if thread root is incorrect',
        prev: {...prev, threadRoot: eth.constants.HashZero},
        sigErr: false,
      },
      {
        args: { ...defaultArgs, txCount: 7 },
        initialThreadStates,
        message: conditionFailure('1 non-zero', 'txCount'),
        name: 'should fail if the tx count is non-zero',
        prev,
        sigErr: false,
      },
      {
        args: { ...defaultArgs, contractAddress: t.mkAddress('0xFFF') },
        initialThreadStates,
        message: conditionFailure('1 non-equivalent', 'contractAddress'),
        name: 'should fail if the contract address is not the same as channel',
        prev,
        sigErr: false,
      },
      {
        args: {
          ...defaultArgs,
          balanceTokenSender: toBN(20),
          balanceWeiSender: toBN(20),
          receiver: sampleAddress,
          sender: t.mkAddress('0x111'),
        },
        initialThreadStates,
        message: 'Hub does not have sufficient Token, Wei balance',
        name: 'should fail if the thread sender (as hub) cannot afford to create the thread',
        prev,
        sigErr: false,
      },
      {
        args: { ...defaultArgs, balanceWeiSender: toBN(20), balanceTokenSender: toBN(20) },
        initialThreadStates,
        message: 'User does not have sufficient Token, Wei balance',
        name: 'should fail if the thread sender (as user) cannot afford to create the thread',
        prev,
        sigErr: false,
      },
    ]) {

      it(tc.name, async () => {
        // ignore recovery by default
        validator.assertThreadSigner = (): any => {/* noop */}
        if (tc.sigErr) {
          validator.assertThreadSigner = (): any => { throw new Error(`Incorrect signer`) }
        }
        // Test against case messages
        const res = validator.openThread(tc.prev, tc.initialThreadStates, tc.args)
        if (tc.message) {
          assert(
            res && res.includes(tc.message),
            `response "${res}" should include "${tc.message}"`,
          )
        } else {
          assert.isUndefined(res, `response "${res}" should be undefined`)
        }
      })

    }
  })

  describe('validator.closeThread', () => {
    // Should test success of the following cases:
    // 1. Should work with user as sender
    // 2. Should work with user as reciever
    // 3. Should work with a single threads
    // 4. Should work with multiple threads

    // TODO: complete test spec
    // Should test failures of the following cases:
    // 1. Initial thread state is not valid (use thread initial state helper)
    // 2. Initial thread states are incorrectly signed
    // 3. Initial thread state is not contained in the root hash
    // 4. The following fields have changed from the approved init state:
    //      - receiver
    //      - sender
    //      - contractAddress
    // 5. Incorrect signature or signer (not signed by sender or wrong payload)
    // 6. Balances are conserved
    // 7. Reciever wei/token balance must be not negative
    // 8. Sender wei/token balance must be not negative
    // 9. TxCount must not be negative
    // 10. Previous channel state is incorrectly signed

    const params = createChannelThreadOverrides(2, {
      receiver: sampleAddress2,
      sender: sampleAddress,
    })
    // contains 2 threads, one where user is sender
    // one where user is receiver
    const initialThreadStates = params.initialThreadStates
    const { threadRoot, threadCount, ...res } = params

    const prev = createPreviousChannelState({
      balanceToken: [10, 10],
      balanceWei: [10, 10],
      threadCount,
      threadRoot,
    })

    const args = createThreadState({
      ...initialThreadStates[0], // user is receiver
      balanceTokenReceiver: 3,
      balanceTokenSender: 2,
      balanceWeiReceiver: 2,
      balanceWeiSender: 3,
      txCount: 1,
    })

    for (const tc of [
      {
        args,
        initialThreadStates,
        message: undefined,
        name: 'should pass with user as sender',
        prev,
        sigErr: false,
      },
      {
        args,
        initialThreadStates,
        message: undefined,
        name: 'should pass with user as receiver',
        prev: {...prev, user: sampleAddress2 },
        sigErr: false,
      },
      {
        args: {...args, threadId: 70},
        initialThreadStates,
        message: undefined,
        name: 'should pass with multiple threads',
        prev,
        sigErr: false,
      },
      {
        args,
        initialThreadStates,
        message: 'Channel user is not a member of this thread state.',
        name: 'should fail if the user is not either sender or receiver',
        prev: {...prev, user: sampleAddress3},
        sigErr: false,
      },
      {
        args,
        initialThreadStates: [initialThreadStates[1]],
        message: 'Thread is not included in channel open threads.',
        name: 'should fail if the args provided is not included in initial state',
        prev,
        sigErr: false,
      },
      {
        args,
        initialThreadStates: [{...initialThreadStates[0], sigA: ''}, initialThreadStates[1]],
        message: 'Incorrect signer',
        name: 'should fail if the initial state is not signed',
        prev,
        sigErr: true,
      },
      {
        args,
        initialThreadStates,
        message: 'Initial thread states not contained in previous state root hash.',
        name: 'should fail if the initial state is not contained in root hash',
        prev: {...prev, threadRoot: eth.constants.HashZero},
        sigErr: false,
      },
      {
        args: {...args, receiver: sampleAddress3},
        initialThreadStates,
        message: 'Thread is not included in channel open threads.',
        name: 'should fail if receiver has changed from initial state',
        prev,
        sigErr: false,
      },
      {
        args: {...args, sender: sampleAddress3},
        initialThreadStates,
        message: 'Thread is not included in channel open threads.',
        name: 'should fail if the sender has changed from initial state',
        prev,
        sigErr: false,
      },
      {
        args: {...args, contractAddress: eth.constants.AddressZero },
        initialThreadStates,
        message: conditionFailure('1 non-equivalent', 'contractAddress'),
        name: 'should fail if the contract address has changed from initial state',
        prev,
        sigErr: false,
      },
      {
        args,
        initialThreadStates,
        message: 'Incorrect sig',
        name: 'should fail if the signer did not sign args',
        prev,
        sigErr: true, // stubs out sig recover in tests
      },
      {
        args: { ...args, balanceWeiSender: toBN(10) },
        initialThreadStates,
        message: conditionFailure('1 non-equivalent', 'weiSum'),
        name: 'should fail if the final state wei balance is not conserved',
        prev,
        sigErr: false,
      },
      {
        args: { ...args, balanceTokenSender: toBN(10) },
        initialThreadStates,
        message: conditionFailure('1 non-equivalent', 'tokenSum'),
        name: 'should fail if the final state token balance is not conserved',
        prev,
        sigErr: false, // stubs out sig recover in tests
      },
      {
        args: {...args, balanceWeiReceiver: toBN(-10) },
        initialThreadStates,
        message: conditionFailure('1 negative', 'balanceWeiReceiver'),
        name: 'should fail if the receiver wei balances are negative',
        prev,
        sigErr: false,
      },
      {
        args: {...args, balanceTokenReceiver: toBN(-10) },
        initialThreadStates,
        message: conditionFailure('1 negative', 'balanceTokenReceiver'),
        name: 'should fail if the receiver token balances are negative',
        prev,
        sigErr: false,
      },
      {
        args: {...args, balanceWeiSender: toBN(-10) },
        initialThreadStates,
        message: conditionFailure('1 negative', 'balanceWeiSender'),
        name: 'should fail if the sender wei balances are negative',
        prev,
        sigErr: false,
      },
      {
        args: {...args, balanceTokenSender: toBN(-10) },
        initialThreadStates,
        message: conditionFailure('1 negative', 'balanceTokenSender'),
        name: 'should fail if the sender token balances are negative',
        prev,
        sigErr: false,
      },
      {
        args: {...args, txCount: -1 },
        initialThreadStates,
        message: conditionFailure('1 negative', 'diff'),
        name: 'should fail if the txCount is negative',
        prev,
        sigErr: false,
      },
      {
        args,
        initialThreadStates,
        message: 'Incorrect signer',
        name: 'should fail if the previous channel state is incorrectly signed',
        prev: {...prev, sigUser: ''},
        sigErr: true,
      },
    ]) {

      it(tc.name, async () => {
        // ignore recovery by default
        validator.assertThreadSigner = (): any => {/* noop */}
        if (tc.sigErr) {
          validator.assertThreadSigner = (): any => { throw new Error(`Incorrect signer`) }
        }
        // Test against case messages
        const result = validator.closeThread(tc.prev, tc.initialThreadStates, tc.args)
        if (tc.message) {
          assert(result && result.includes(tc.message))
        } else {
          assert.isUndefined(result)
        }
      })

    }
  })

  const getProposePendingCases = (): any => {
    const prev = createPreviousChannelState({
      balanceToken: [5, 5],
      balanceWei: [5, 5],
    })
    const args = createProposePendingArgs()

    return [
      {
        args,
        name: 'should work',
        prev,
        valid: true,
      },
      {
        args: createProposePendingArgs({
          depositWeiUser: -1,
        }),
        name: 'should fail if args are negative',
        prev,
        valid: false,
      },
      {
        args: createProposePendingArgs({
          withdrawalWeiUser: 100,
        }),
        name: 'should error if withdrawal exceeds balance',
        prev,
        valid: false,
      },
      {
        args: createProposePendingArgs({
          timeout: -1,
        }),
        name: 'should error if timeout is negative',
        prev,
        valid: false,
      },
    ]
  }

  describe('proposePending', () => {
    getProposePendingCases().forEach(async ({ name, prev, args, valid }: any) => {
      it(name, async () => {
        if (valid) {
          assert.isUndefined(await validator.proposePending(prev, args))
        } else {
          assert.exists(await validator.proposePending(prev, args))
        }
      })
    })
  })

  describe('proposePendingExchange', () => {
    const prev = createPreviousChannelState({
      balanceToken: [5, 5],
      balanceWei: [5, 5],
    })
    const args: PendingExchangeArgsBN = {
      exchangeRate: '2',
      seller: 'user',
      tokensToSell: toBN(0),
      weiToSell: toBN(0),
      ...createProposePendingArgs(),
    }

    const proposePendingExchangeCases = [
      {
        args: {
          ...args,
          tokensToSell: toBN(2),
          withdrawalTokenUser: toBN(3),
        },
        name: 'exchange + withdrawal makes balance 0',
        prev,
        valid: true,
      },
      {
        args: {
          ...args,
          tokensToSell: toBN(4),
          withdrawalTokenUser: toBN(4),
        },
        name: 'exchange + withdrawal makes balance negative',
        prev,
        valid: false,
      },
      {
        args: {
          ...args,
          tokensToSell: toBN(5),
          withdrawalTokenHub: toBN(7),
        },
        name: 'hub withdraws sold tokens',
        prev,
        valid: true,
      },
      {
        args: {
          ...args,
          tokensToSell: toBN(4),
          withdrawalWeiUser: toBN(7),
        },
        name: 'user withdraws purchased wei',
        prev,
        valid: true,
      },
    ]

    const runCase = (tc: {
      args: PendingExchangeArgsBN, name: string, prev: ChannelStateBN, valid: boolean,
    }): void => {
      it(tc.name, async () => {
        if (tc.valid) {
          assert.isUndefined(await validator.proposePendingExchange(tc.prev, tc.args))
        } else {
          assert.exists(await validator.proposePendingExchange(tc.prev, tc.args))
        }
      })
    }

    proposePendingExchangeCases.forEach(runCase)

    describe('with pending cases', () => {
      getProposePendingCases().forEach((tc: any): any => {
        runCase({ ...tc, args: { ...args, weiToSell: toBN(1), ...tc.args } })
      })
    })

    describe('with exchange cases', () => {
      getExchangeCases().forEach((tc: any): any => {
        runCase({ ...tc, args: { ...args, ...tc.args as ExchangeArgsBN } })
      })
    })
  })

  // Should test the following success cases:
  // 1. A thread payment from sender to receiver works
  // 2. Multiple more payments work
  // Should test the following fail cases:
  // 1. Incorrect thread initial state (use initial state helper)
  // 2. Same following fields as initial state
  //        - sender
  //        - receiver
  //        - contract address
  // 3. Incorrect signer
  // 4. Balances are not conserved
  // 5. Balances are negative
  // 6. Receiver balances decrease as compared to previous thread state
  // 7. TxCount must be one higher than previous thread state
  // 8. Initial thread states are incorrectly signed
  // 9. Previous thread state is incorrectly signed(?)

  describe('threadPayment', () => {
    const prev = createThreadState()
    const args = createThreadPaymentArgs()

    for (const tc of [
      {
        args,
        name: 'should work',
        valid: true,
      },
      {
        args: createThreadPaymentArgs({
          amountToken: -1,
          amountWei: -1,
        }),
        name: 'should fail if payment args are negative',
        valid: false,
      },
      {
        args: createThreadPaymentArgs({
          amountToken: 20,
          amountWei: 20,
        }),
        name: 'should fail if payment exceeds available thread balance',
        valid: false,
      },
    ]) {

      it(tc.name, async () => {
        if (tc.valid) {
          assert.isUndefined(await validator.threadPayment(prev, tc.args))
        } else {
          assert.exists(await validator.threadPayment(prev, tc.args))
        }
      })

    }
  })
})
