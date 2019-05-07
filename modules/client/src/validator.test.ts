import { ethers as eth } from 'ethers'
import * as sinon from 'sinon'

import { default as ChannelManagerAbi } from './contract/ChannelManagerAbi'
import { Big } from './lib/bn'
import { EMPTY_ROOT_HASH } from './lib/constants'
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
  Provider,
  proposePendingNumericArgs,
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

/* Overrides for these fns function must be in the contract format
as they are used in solidity decoding. Returns tx with default deposit
values of all 5s
*/
function createMockedWithdrawalTxReceipt(
  sender: 'user' | 'hub',
  abi: Interface,
  ...overrides: any[]
): any {
  const vals: any = generateTransactionReceiptValues({
    pendingTokenUpdates: ['0', '5', '0', '5'],
    pendingWeiUpdates: ['0', '5', '0', '5'],
    senderIdx: sender === 'user' ? '1' : '0', // default to user wei deposit 5
  }, overrides)
  return createMockedTransactionReceipt(abi, vals)
}

function createMockedDepositTxReceipt(
  sender: 'user' | 'hub',
  abi: Interface,
  ...overrides: any[]
): any {
  const vals: any = generateTransactionReceiptValues({
    pendingTokenUpdates: ['5', '0', '5', '0'],
    pendingWeiUpdates: ['5', '0', '5', '0'],
    senderIdx: sender === 'user' ? '1' : '0', // default to user wei deposit 5
  }, overrides)
  return createMockedTransactionReceipt(abi, vals)
}

function generateTransactionReceiptValues(...overrides: any[]): any {
  return Object.assign({
    pendingTokenUpdates: ['0', '0', '0', '0'],
    pendingWeiUpdates: ['0', '0', '0', '0'],
    senderIdx: '1', // default to user wei deposit 5
    threadCount: '0',
    threadRoot: EMPTY_ROOT_HASH,
    tokenBalances: ['0', '0'],
    txCount: ['1', '1'],
    user: sampleAddress,
    weiBalances: ['0', '0'],
  }, ...overrides)
}

function createMockedTransactionReceipt(abi: Interface, vals: any): any {
  //console.log(`creating tx receipt from vals: ${JSON.stringify(vals,null,2)}`)
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

  // console.log(`Created logs w pending wei update: ${JSON.stringify(abi.parseLog(logs[0]).pendingWeiUpdates)}`)

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

function createPreviousChannelState(...overrides: t.PartialSignedOrSuccinctChannel[]): any {
  const state: any = t.getChannelState('empty', Object.assign({
    sigHub: t.mkHash('errywhere'),
    sigUser: t.mkHash('booty'),
    user: sampleAddress,
  }, ...overrides))
  return convertChannelState('bn', state)
}

function createThreadPaymentArgs(...overrides: Array<Partial<PaymentArgs<any>>>): any {
  const { recipient, ...amts }: any = createPaymentArgs(...overrides)
  return amts
}

function createPaymentArgs(
  ...overrides: Array<Partial<PaymentArgs<any>>>
): PaymentArgsBN {
  const args: any = Object.assign({
    amountToken: '0',
    amountWei: '0',
    recipient: 'user',
  }, ...overrides) as any
  return convertPayment('bn', { ...convertPayment('str', args) })
}

function createProposePendingArgs(overrides?: Partial<PendingArgs<number>>): PendingArgsBN {
  const res: any = {
    recipient: '0x1234',
    timeout: 0,
  } as PendingArgs
  proposePendingNumericArgs.forEach((a: string) => (res as any)[a] = 0)
  return convertProposePending('bn', {
    ...res,
    ...(overrides || {}),
  })
}

function createThreadState(...overrides: t.PartialSignedOrSuccinctThread[]): any {
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

function createChannelThreadOverrides(targetThreadCount: number, ...overrides: any[]): any {
  const utils: Utils = new Utils()
  if (!targetThreadCount) {
    return {
      initialThreadStates: [],
      threadCount: 0,
      threadRoot: EMPTY_ROOT_HASH,
    }
  }
  const initialThreadStates: ThreadState[] = [] as ThreadState[]
  for (let i: number = 0; i < targetThreadCount; i++) {
    initialThreadStates.push(convertThreadState('str', createThreadState(Object.assign({
      receiver: t.mkAddress(`0x${i + 1}`),
      threadId: 69 + i,
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

    const paymentTestCases = [
      {
        name: 'valid hub to user payment',
        args: createPaymentArgs({
          amountToken: 1,
          amountWei: '1',
        }),
        valid: true
      },
      {
        name: 'valid user to hub payment',
        args: createPaymentArgs({ recipient: "hub" }),
        valid: true
      },
      {
        name: 'should return a string payment args are negative',
        args: createPaymentArgs({ amountToken: -1, amountWei: -1 }),
        valid: false,
      },
      {
        name: 'should return a string if payment exceeds available channel balance',
        args: createPaymentArgs({ amountToken: 10, amountWei: 10 }),
        valid: false,
      }
    ]

    paymentTestCases.forEach(({ name, args, valid }) => {
      it(name, () => {
        if (valid)
          assert.isNull(validator.channelPayment(prev, args))
        else
          assert.exists(validator.channelPayment(prev, args))
      })
    })
  })

  function getExchangeCases() {
    const prev = createPreviousChannelState({
      balanceToken: [5, 5],
      balanceWei: [5, 5],
    })

    let baseWeiToToken = {
      weiToSell: Big(1),
      tokensToSell: Big(0),
      exchangeRate: '5',
      seller: "user"
    }

    let baseTokenToWei = {
      weiToSell: Big(0),
      tokensToSell: Big(5),
      exchangeRate: '5',
      seller: "user"
    }

    return [
      {
        name: 'valid token for wei exchange seller is user',
        prev,
        args: baseTokenToWei,
        valid: true,
      },
      {
        name: 'valid token for wei exchange seller is hub',
        prev,
        args: { ...baseTokenToWei, seller: "hub" },
        valid: true,
      },
      {
        name: 'valid wei for token exchange seller is user',
        prev,
        args: baseWeiToToken,
        valid: true,
      },
      {
        name: 'valid wei for token exchange seller is user',
        prev,
        args: { ...baseWeiToToken, seller: "hub" },
        valid: true,
      },
      {
        name: 'should return a string if both toSell values are zero',
        prev,
        args: { ...baseWeiToToken, weiToSell: Big(0) },
        valid: false,
      },
      {
        name: 'should return a string if neither toSell values are zero',
        prev,
        args: { ...baseWeiToToken, tokensToSell: Big(1) },
        valid: false,
      },
      {
        name: 'should return a string if negative wei to sell is provided',
        prev,
        args: { ...baseWeiToToken, weiToSell: Big(-5) },
        valid: false,
      },
      {
        name: 'should return a string if negative tokens to sell is provided',
        prev,
        args: { ...baseTokenToWei, tokensToSell: Big(-5) },
        valid: false,
      },
      {
        name: 'should return a string if seller cannot afford tokens for wei exchange',
        prev,
        args: { ...baseTokenToWei, tokensToSell: Big(10) },
        valid: false,
      },
      {
        name: 'should return a string if seller cannot afford wei for tokens exchange',
        prev,
        args: { ...baseWeiToToken, weiToSell: Big(10) },
        valid: false,
      },
      {
        name: 'should return a string if payor cannot afford wei for tokens exchange',
        prev,
        args: { ...baseWeiToToken, weiToSell: Big(2), },
        valid: false,
      },
      {
        name: 'should return a string if payor as hub cannot afford tokens for wei exchange',
        prev: { ...prev, balanceWeiHub: Big(0) },
        args: { ...baseTokenToWei, weiToSell: Big(10) },
        valid: false,
      },
      {
        name: 'should return a string if payor as user cannot afford tokens for wei exchange',
        prev: { ...prev, balanceWeiUser: Big(0) },
        args: { ...baseTokenToWei, weiToSell: Big(10), seller: "user" },
        valid: false,
      },
    ]
  }

  describe('exchange', () => {
    getExchangeCases().forEach(({ name, prev, args, valid }) => {
      it(name, () => {
        if (valid) {
          assert.isNull(validator.exchange(prev, args as ExchangeArgsBN))
        } else {
          assert.exists(validator.exchange(prev, args as ExchangeArgsBN))
        }
      })
    })
  })

  describe('proposePendingDeposit', () => {
    const prev = createPreviousChannelState({
      balanceToken: [5, 5],
      balanceWei: [5, 5]
    })
    const args = {
      depositWeiHub: Big(1),
      depositWeiUser: Big(1),
      depositTokenHub: Big(1),
      depositTokenUser: Big(1),
      timeout: 6969,
    }

    const proposePendingDepositCases = [
      {
        name: 'should work',
        prev,
        args,
        valid: true
      },
      {
        name: 'should return a string if pending operations exist on the previous state',
        prev: { ...prev, pendingDepositWeiUser: Big(5) },
        args,
        valid: false
      },
      {
        name: 'should return a string for negative deposits',
        prev,
        args: { ...args, depositWeiUser: Big(-5) },
        valid: false
      },
      {
        name: 'should return a string if 0 timeout provided',
        prev,
        args: { ...args, timeout: 0 },
        valid: true
      },
      {
        name: 'should return a string if negative timeout provided',
        prev,
        args: { ...args, timeout: -5 },
        valid: false
      },
    ]

    proposePendingDepositCases.forEach(({ name, prev, args, valid }) => {
      it(name, () => {
        if (valid) {
          assert.isNull(validator.proposePendingDeposit(prev, args))
        } else {
          assert.exists(validator.proposePendingDeposit(prev, args))
        }
      })
    })
  })

  describe('proposePendingWithdrawal', () => {
    const prev: ChannelStateBN = createPreviousChannelState({
      balanceWei: [10, 5],
      balanceToken: [5, 10]
    })
    const args: WithdrawalArgsBN = convertWithdrawal("bn", t.getWithdrawalArgs("empty", {
      exchangeRate: '2',
      tokensToSell: 10,
      targetWeiUser: 0,
      targetWeiHub: 5,
    }))

    const withdrawalCases: { name: any, prev: ChannelStateBN, args: WithdrawalArgsBN, valid: boolean }[] = [
      {
        name: 'should work',
        prev,
        args,
        valid: true
      },
      {
        name: 'should return a string if there are pending ops in prev',
        prev: { ...prev, pendingDepositWeiUser: Big(10) },
        args,
        valid: false
      },
      {
        name: 'should return a string if the args have a negative value',
        prev,
        args: { ...args, weiToSell: Big(-5) },
        valid: false
      },
      {
        name: 'should return a string if resulting state has negative values',
        prev,
        args: { ...args, tokensToSell: Big(20) },
        valid: false
      },
      {
        name: 'should return a string if the args result in an invalid transition',
        prev,
        args: { ...args, weiToSell: Big(10), tokensToSell: Big(0), additionalWeiHubToUser: Big(30) },
        valid: false
      },
      // TODO: find out which args may result in this state from the
      // withdrawal function (if any) from wolever
      // {
      //   name: 'should return a string if hub collateralizes an exchange and withdraws with the same currency',
      //   prev,
      //   args: '',
      //   valid: false
      // },
    ]

    withdrawalCases.forEach(({ name, prev, args, valid }) => {
      it(name, () => {
        const res = validator.proposePendingWithdrawal(prev, args)
        if (valid) {
          assert.isNull(res)
        } else {
          assert.exists(res)
        }
      })
    })
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

    const confirmCases: any[] = [
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
        prev: { ...prevDeposit, user: prevDeposit.user.toUpperCase(), recipient: prevDeposit.user.toUpperCase() },
        stubs: [tx, depositReceipt],
        valid: true,
      },
      {
        name: 'should return a string if no transaction is found with that hash',
        prev: prevWd,
        stubs: [null, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if transaction is not sent to contract',
        prev: prevDeposit,
        stubs: [{ ...tx, to: t.mkAddress('0xfail') }, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if transaction is not sent by participants',
        prev: { ...prevDeposit, user: t.mkAddress('0xUUU'), },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if user is not same in receipt and previous',
        prev: { ...prevDeposit, user: t.mkAddress('0xUUU'), },
        stubs: [tx, createMockedDepositTxReceipt("hub", abi)],
        valid: false,
      },
      // {
      //   name: 'should return a string if balance wei hub is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceWeiHub: Big(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should return a string if balance wei user is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceWeiUser: Big(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should return a string if balance token hub is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceTokenHub: Big(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should return a string if balance token user is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceTokenUser: Big(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      {
        name: 'should return a string if pending deposit wei hub is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositWeiHub: Big(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending deposit wei user is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositWeiUser: Big(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending deposit token hub is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositTokenHub: Big(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending deposit token user is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositTokenUser: Big(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending withdrawal wei hub is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalWeiHub: Big(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending withdrawal wei user is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalWeiUser: Big(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending withdrawal token hub is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalTokenHub: Big(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending withdrawal token user is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalTokenUser: Big(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      // {
      //   name: 'should return a string if tx count global is not same in receipt and previous',
      //   prev: { ...prevDeposit, txCountGlobal: 7 },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      {
        name: 'should return a string if tx count chain is not same in receipt and previous',
        prev: { ...prevDeposit, txCountChain: 7 },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      // {
      //   name: 'should return a string if thread root is not same in receipt and previous',
      //   prev: { ...prevDeposit, threadRoot: t.mkHash('0xROOTZ') },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should return a string if thread count is not same in receipt and previous',
      //   prev: { ...prevDeposit, threadCount: 7 },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      */
    ]

    confirmCases.forEach(async ({ name, prev, stubs, valid }: any): Promise<any> => {

      it.skip(name, async () => {
        // set tx receipt stub
        validator.provider.getTransaction = sinon.stub().returns(stubs[0])
        validator.provider.getTransactionReceipt = sinon.stub().returns(stubs[1])

        // console.log(`comparing event to prev`)
        // console.log(`event logs: ${JSON.stringify(abi.parseLog(stubs[1][0]),null,2)}`)
        // console.log(`prev: ${JSON.stringify(prev,null,2)}`)

        // set args
        const transactionHash: string = depositReceipt.transactionHash
          //(stubs[1] && (stubs[1] as any).transactionHash === depositReceipt.transactionHash)
          //  ? depositReceipt.transactionHash
          //  : wdReceipt.transactionHash

        if (valid) {
          assert.isNull(await validator.confirmPending(prev, { transactionHash }))
        } else {
          assert.exists(await validator.confirmPending(prev, { transactionHash }))
        }
      })

    })
  })

  describe('invalidation', () => {
    const prev = createPreviousChannelState({
      txCount: [1, 1]
    })

    const args: InvalidationArgs = {
      previousValidTxCount: prev.txCountGlobal,
      lastInvalidTxCount: prev.txCountGlobal + 1,
      reason: "CU_INVALID_ERROR",
    }

    const invalidationCases = [
      {
        name: 'should work',
        prev,
        args,
        valid: true
      },
      {
        name: 'should return string if previous nonce is higher than nonce to be invalidated',
        prev,
        args: { ...args, previousValidTxCount: 3 },
        valid: false
      },
      {
        name: 'should return string if previous state nonce and nonce in args do not match',
        prev: { ...prev, txCountGlobal: 5 },
        args: { ...args, previousValidTxCount: 3, lastInvalidTxCount: 3 },
        valid: false
      },
      {
        name: 'should return string if previous state has pending ops',
        prev: { ...prev, pendingDepositWeiUser: Big(5) },
        args,
        valid: false
      },
      {
        name: 'should return string if previous state is missing sigHub',
        prev: { ...prev, sigHub: '' },
        args,
        valid: false
      },
      {
        name: 'should return string if previous state is missing sigUser',
        prev: { ...prev, sigUser: '' },
        args,
        valid: false
      },
    ]

    invalidationCases.forEach(({ name, prev, args, valid }) => {
      it(name, () => {
        if (valid) {
          assert.isNull(validator.invalidation(prev, args))
        } else {
          assert.exists(validator.invalidation(prev, args))
        }
      })
    })
  })

  describe('validator.openThread', () => {

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


    const params = createChannelThreadOverrides(2)
    const initialThreadStates = params.initialThreadStates
    const { threadRoot, threadCount, ...res } = params

    const prev = createPreviousChannelState({
      threadCount,
      threadRoot,
      balanceToken: [10, 10],
      balanceWei: [10, 10]
    })

    const args = createThreadState()

    const cases = [
      {
        name: 'should fail if user is not either sender or receiver',
        prev,
        initialThreadStates,
        sigErr: false,
        args: {...args, sender: t.mkAddress('0xA11')},
        message: "Channel user is not a member of this thread state.",
      },
      {
        name: 'should fail if the receiver wei balance is greater than zero',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceWeiReceiver: Big(2) },
        message: `There were 1 non-zero fields detected (detected fields and values: [{"field":"balanceWeiReceiver"`,
      },
      {
        name: 'should fail if the receiver token balance is greater than zero',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceTokenReceiver: Big(2) },
        message: `There were 1 non-zero fields detected (detected fields and values: [{"field":"balanceTokenReceiver"`,
      },
      {
        name: 'should return a string if the receiver wei balance is less than zero',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceWeiReceiver: Big(-2) },
        message: `There were 1 non-zero fields detected (detected fields and values: [{"field":"balanceWeiReceiver"`,
      },
      {
        name: 'should return a string if the receiver token balance is less than zero',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceTokenReceiver: Big(-2) },
        message: `There were 1 non-zero fields detected (detected fields and values: [{"field":"balanceTokenReceiver"`,
      },
      {
        name: 'should return a string if the sender is the receiver',
        prev,
        initialThreadStates,
        sigErr: false,
        args: {...args, receiver: sampleAddress },
        message: "Sender cannot be receiver.",
      },
      {
        name: 'should return a string if sender is hub',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, sender: hubAddress, receiver: sampleAddress },
        message: "Sender cannot be hub",
      },
      {
        name: 'should return a string if receiver is hub',
        prev,
        initialThreadStates,
        sigErr: false,
        args: {...args, receiver: hubAddress },
        message: "Receiver cannot be hub",
      },
      {
        name: 'should return a string if sender is channel manager',
        prev,
        initialThreadStates,
        sigErr: false,
        args: {...args, sender: prev.contractAddress, receiver: sampleAddress },
        message: "Sender cannot be contract",
      },
      {
        name: 'should return a string if receiver is channel manager',
        prev,
        initialThreadStates,
        sigErr: false,
        args: {...args, receiver: prev.contractAddress},
        message: "Receiver cannot be contract",
      },
      {
        name: 'should return a string if an incorrect signer is detected',
        prev,
        initialThreadStates,
        sigErr: true,
        args,
        message: "Incorrect signer",
      },
      {
        name: 'should return a string if thread root is incorrect',
        prev: {...prev, threadRoot: EMPTY_ROOT_HASH},
        initialThreadStates,
        sigErr: false,
        args,
        message: "Initial thread states not contained in previous state root hash",
      },
      {
        name: 'should return a string if the tx count is non-zero',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, txCount: 7 },
        message: `There were 1 non-zero fields detected (detected fields and values: [{"field":"txCount"`,
      },
      {
        name: 'should return a string if the contract address is not the same as channel',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, contractAddress: t.mkAddress('0xFFF') },
        message: `There were 1 non-equivalent fields detected (detected fields and values: [{"field":"contractAddress"`,
      },
      {
        name: 'should return a string if the thread sender (as hub) cannot afford to create the thread',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceWeiSender: Big(20), balanceTokenSender: Big(20), receiver: sampleAddress, sender: t.mkAddress("0x111")},
        message: "Hub does not have sufficient Token, Wei balance",
      },
      {
        name: 'should return a string if the thread sender (as user) cannot afford to create the thread',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceWeiSender: Big(20), balanceTokenSender: Big(20) },
        message: "User does not have sufficient Token, Wei balance",
      },
      {
        name: 'should work with first thread',
        prev: { ...prev, threadRoot: EMPTY_ROOT_HASH, threadCount: 0 },
        initialThreadStates: [],
        sigErr: false,
        args,
        message: null,
      },
      {
        name: 'should work for additional threads',
        prev,
        initialThreadStates,
        sigErr: false,
        args,
        message: null,
      },
    ]

    cases.forEach(async ({ name, prev, initialThreadStates, sigErr, args, message }) => {
      it(name, async () => {
        // ignore recovery by default
        validator.assertThreadSigner = () => {}
        if (sigErr) {
          validator.assertThreadSigner = () => { throw new Error(`Incorrect signer`) }
        }
        // Test against case messages
        const res = validator.openThread(prev, initialThreadStates, args)
        if (message) {
          assert(res && res.includes(message))
        } else {
          assert.isNull(res)
        }
      })
    })
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

    const params = createChannelThreadOverrides(2, { sender: sampleAddress, receiver: sampleAddress2 })
    // contains 2 threads, one where user is sender 
    // one where user is receiver
    const initialThreadStates = params.initialThreadStates
    const { threadRoot, threadCount, ...res } = params

    const prev = createPreviousChannelState({
      threadCount,
      threadRoot,
      balanceToken: [10, 10],
      balanceWei: [10, 10]
    })

    const args = createThreadState({
      ...initialThreadStates[0], // user is receiver
      balanceWeiSender: 3,
      balanceWeiReceiver: 2,
      balanceTokenSender: 2,
      balanceTokenReceiver: 3,
      txCount: 1
    })

    const cases = [
      {
        name: 'should return a string if the user is not either sender or receiver',
        prev: {...prev, user: sampleAddress3},
        initialThreadStates,
        args,
        sigErr: false,
        message: 'Channel user is not a member of this thread state.'
      },
      {
        name: 'should return a string if the args provided is not included in initial state',
        prev,
        initialThreadStates: [initialThreadStates[1]],
        args,
        sigErr: false,
        message: 'Thread is not included in channel open threads.',
      },
      {
        name: 'should return a string if the initial state is not signed',
        prev,
        initialThreadStates: [{...initialThreadStates[0], sigA: ''}, initialThreadStates[1]],
        args,
        sigErr: true,
        message: 'Incorrect signer'
      },
      {
        name: 'should return a string if the initial state is not contained in root hash',
        prev: {...prev, threadRoot: EMPTY_ROOT_HASH},
        initialThreadStates,
        args,
        sigErr: false,
        message: 'Initial thread states not contained in previous state root hash.'
      },
      {
        name: 'should return a string if receiver has changed from initial state',
        prev,
        initialThreadStates,
        args: {...args, receiver: sampleAddress3},
        sigErr: false,
        message: 'Thread is not included in channel open threads.'
      },
      {
        name: 'should return a string if the sender has changed from initial state',
        prev,
        initialThreadStates,
        args: {...args, sender: sampleAddress3},
        sigErr: false,
        message: 'Thread is not included in channel open threads.',
      },
      {
        name: 'should return a string if the contract address has changed from initial state',
        prev,
        initialThreadStates,
        args: {...args, contractAddress: eth.constants.AddressZero },
        sigErr: false,
        message: 'There were 1 non-equivalent fields detected (detected fields and values: [{"field":"contractAddress"',
      },
      {
        name: 'should return a string if the signer did not sign args',
        prev,
        initialThreadStates,
        args,
        sigErr: true, // stubs out sig recover in tests
        message: 'Incorrect sig',
      },
      {
        name: 'should return a string if the final state wei balance is not conserved',
        prev,
        initialThreadStates,
        args: { ...args, balanceWeiSender: Big(10) },
        sigErr: false,
        message: 'There were 1 non-equivalent fields detected (detected fields and values: [{"field":"weiSum"',
      },
      {
        name: 'should return a string if the final state token balance is not conserved',
        prev,
        initialThreadStates,
        args: { ...args, balanceTokenSender: Big(10) },
        sigErr: false, // stubs out sig recover in tests
        message: 'There were 1 non-equivalent fields detected (detected fields and values: [{"field":"tokenSum"',
      },
      {
        name: 'should return a string if the receiver wei balances are negative',
        prev,
        initialThreadStates,
        args: {...args, balanceWeiReceiver: Big(-10) },
        sigErr: false,
        message: 'There were 1 negative fields detected (detected fields and values: [{"field":"balanceWeiReceiver"'
      }, 
      {
        name: 'should return a string if the receiver token balances are negative',
        prev,
        initialThreadStates,
        args: {...args, balanceTokenReceiver: Big(-10) },
        sigErr: false,
        message: 'There were 1 negative fields detected (detected fields and values: [{"field":"balanceTokenReceiver"'
      }, 
      {
        name: 'should return a string if the sender wei balances are negative',
        prev,
        initialThreadStates,
        args: {...args, balanceWeiSender: Big(-10) },
        sigErr: false,
        message: 'There were 1 negative fields detected (detected fields and values: [{"field":"balanceWeiSender"'
      }, 
      {
        name: 'should return a string if the sender token balances are negative',
        prev,
        initialThreadStates,
        args: {...args, balanceTokenSender: Big(-10) },
        sigErr: false,
        message: 'There were 1 negative fields detected (detected fields and values: [{"field":"balanceTokenSender"'
      }, 
      {
        name: 'should return a string if the txCount is negative',
        prev,
        initialThreadStates,
        args: {...args, txCount: -1 },
        sigErr: false,
        message: 'There were 1 negative fields detected (detected fields and values: [{"field":"diff"'
      }, 
      {
        name: 'should return a string if the previous channel state is incorrectly signed',
        prev: {...prev, sigUser: ''},
        initialThreadStates,
        args,
        sigErr: true,
        message: 'Incorrect signer'
      },
      {
        name: 'should work with user as sender',
        prev,
        initialThreadStates,
        args,
        sigErr: false,
        message: null,
      },
      {
        name: 'should work with user as receiver',
        prev: {...prev, user: sampleAddress2 },
        initialThreadStates,
        args,
        sigErr: false,
        message: null
      },
      {
        name: 'should work with multiple threads',
        prev,
        initialThreadStates,
        args: {...args, threadId: 70},
        sigErr: false,
        message: null
      },
    ]

    cases.forEach(async ({ name, prev, initialThreadStates, sigErr, args, message }) => {
      it(name, async () => {
        // ignore recovery by default
        validator.assertThreadSigner = () => {}
        if (sigErr) {
          validator.assertThreadSigner = () => { throw new Error(`Incorrect signer`) }
        }
        // Test against case messages
        const res = validator.closeThread(prev, initialThreadStates, args)
        if (message) {
          assert(res && res.includes(message + ""))
        } else {
          assert.isNull(res)
        }
      })
    })
  })

  function getProposePendingCases() {
    const prev = createPreviousChannelState({
      balanceToken: [5, 5],
      balanceWei: [5, 5],
    })
    const args = createProposePendingArgs()

    return [
      {
        name: 'should work',
        prev,
        args,
        valid: true,
      },
      {
        name: 'should return a string if args are negative',
        prev,
        args: createProposePendingArgs({
          depositWeiUser: -1,
        }),
        valid: false,
      },
      {
        name: 'should error if withdrawal exceeds balance',
        prev,
        args: createProposePendingArgs({
          withdrawalWeiUser: 100,
        }),
        valid: false,
      },
      {
        name: 'should error if timeout is negative',
        prev,
        args: createProposePendingArgs({
          timeout: -1,
        }),
        valid: false,
      },
    ]
  }

  describe('proposePending', () => {
    getProposePendingCases().forEach(async ({ name, prev, args, valid }) => {
      it(name, async () => {
        if (valid) {
          assert.isNull(await validator.proposePending(prev, args))
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
      weiToSell: Big(0),
      tokensToSell: Big(0),
      seller: "user",
      ...createProposePendingArgs(),
    }

    function runCase(tc: { name: string, prev: ChannelStateBN, args: PendingExchangeArgsBN, valid: boolean }) {
      it(tc.name, async () => {
        if (tc.valid) {
          assert.isNull(await validator.proposePendingExchange(tc.prev, tc.args))
        } else {
          assert.exists(await validator.proposePendingExchange(tc.prev, tc.args))
        }
      })
    }

    const proposePendingExchangeCases = [
      {
        name: 'exchange + withdrawal makes balance 0',
        prev,
        args: {
          ...args,
          tokensToSell: Big(2),
          withdrawalTokenUser: Big(3),
        },
        valid: true,
      },

      {
        name: 'exchange + withdrawal makes balance negative',
        prev,
        args: {
          ...args,
          tokensToSell: Big(4),
          withdrawalTokenUser: Big(4),
        },
        valid: false,
      },

      {
        name: 'hub withdraws sold tokens',
        prev,
        args: {
          ...args,
          tokensToSell: Big(5),
          withdrawalTokenHub: Big(7),
        },
        valid: true,
      },

      {
        name: 'user withdraws purchased wei',
        prev,
        args: {
          ...args,
          tokensToSell: Big(4),
          withdrawalWeiUser: Big(7),
        },
        valid: true,
      },

    ]

    proposePendingExchangeCases.forEach(runCase)

    describe('with pending cases', () => {
      getProposePendingCases().forEach(tc => {
        runCase({ ...tc, args: { ...args, weiToSell: Big(1), ...tc.args } })
      })
    })

    describe('with exchange cases', () => {
      getExchangeCases().forEach(tc => {
        runCase({ ...tc, args: { ...args, ...tc.args as ExchangeArgsBN } })
      })
    })
  })

  describe('threadPayment', () => {
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

    const prev = createThreadState()
    const args = createThreadPaymentArgs()

    const threadPaymentCases = [
      {
        name: 'should work',
        args,
        valid: true,
      },
      {
        name: 'should return a string if payment args are negative',
        args: createThreadPaymentArgs({
          amountToken: -1,
          amountWei: -1,
        }),
        valid: false,
      },
      {
        name: 'should return a string if payment exceeds available thread balance',
        args: createThreadPaymentArgs({
          amountToken: 20,
          amountWei: 20,
        }),
        valid: false,
      },
    ]

    threadPaymentCases.forEach(async ({ name, args, valid }) => {
      it(name, async () => {
        if (valid) {
          assert.isNull(await validator.threadPayment(prev, args))
        } else {
          assert.exists(await validator.threadPayment(prev, args))
        }
      })
    })
  })
})


/* EG of tx receipt obj string, use JSON.parse
const txReceipt = `{"transactionHash":"${t.mkHash('0xhash')}","transactionIndex":0,"blockHash":"0xe352de5c890efc61876e239e15ed474f93604fdbc5f542ff28c165c25b0b6d55","blockNumber":437,"gasUsed":609307,"cumulativeGasUsed":609307,"contractAddress":"${t.mkAddress('0xCCC')}","logs":[{"logIndex":0,"transactionIndex":0,"transactionHash":"0xae51947afec970dd134ce1d8589c924b99bfa6a3b7f2d61cb95a447804a196a7","blockHash":"${t.mkHash('0xblock')}","blockNumber":437,"address":"0x9378e143606A4666AD5F20Ac8865B44e703e321e","data":"0x0000000000000000000000000000000000000000000000000000000000000000","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000002da565caa7037eb198393181089e92181ef5fb53","0x0000000000000000000000003638eeb7733ed1fb83cf028200dfb2c41a6d9da8"],"type":"mined","id":"log_9f6b5361"},{"logIndex":1,"transactionIndex":0,"transactionHash":"0xae51947afec970dd134ce1d8589c924b99bfa6a3b7f2d61cb95a447804a196a7","blockHash":"0xe352de5c890efc61876e239e15ed474f93604fdbc5f542ff28c165c25b0b6d55","blockNumber":437,"address":"0x9378e143606A4666AD5F20Ac8865B44e703e321e","data":"0x0000000000000000000000000000000000000000000000000000000000000000","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000003638eeb7733ed1fb83cf028200dfb2c41a6d9da8","0x0000000000000000000000002da565caa7037eb198393181089e92181ef5fb53"],"type":"mined","id":"log_18b4ce0a"},{"logIndex":2,"transactionIndex":0,"transactionHash":"0xae51947afec970dd134ce1d8589c924b99bfa6a3b7f2d61cb95a447804a196a7","blockHash":"0xe352de5c890efc61876e239e15ed474f93604fdbc5f542ff28c165c25b0b6d55","blockNumber":437,"address":"0x3638EEB7733ed1Fb83Cf028200dfb2C41A6D9DA8","data":"0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","topics":["0xeace9ecdebd30bbfc243bdc30bfa016abfa8f627654b4989da4620271dc77b1c","0x0000000000000000000000002da565caa7037eb198393181089e92181ef5fb53"],"type":"mined","id":"log_bc5572a6"}],"status":true,"logsBloom":"0x00000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000020000000000000000000020000000000000000000008000000000000000000040000000000000008000000420000000000000000000000000000080000000000000000000810000000000000000000000000000000000000000000020000000000000000000000000000000100000000000000000000000000000000000000000000000000040000000000000002000008000000000000000000000000000000000000000000000000000000008000000000000000000000000000001000000000000000000000000000"}`
*/
