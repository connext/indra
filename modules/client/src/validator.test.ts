import { assert } from './testing/index'
import * as t from './testing/index'
import { Validator } from './validator';
import * as sinon from 'sinon'
import { Utils, emptyAddress } from './Utils';
import { convertChannelState, convertPayment, PaymentArgs, PaymentArgsBN, convertThreadState, ThreadState, ChannelStateBN, WithdrawalArgsBN, convertWithdrawal, ExchangeArgs, ExchangeArgsBN, convertArgs, PendingArgs, proposePendingNumericArgs, convertProposePending, PendingArgsBN, PendingExchangeArgsBN, InvalidationArgs, UnsignedThreadState, ChannelState } from './types';
import { toBN } from './helpers/bn';
import { EMPTY_ROOT_HASH } from './lib/constants';
import Web3T from 'web3'
const Web3 = require('web3')

const eventInputs = [
  { type: 'address', name: 'user', indexed: true },
  { type: 'uint256', name: 'senderIdx' },
  { type: 'uint256[2]', name: 'weiBalances' },
  { type: 'uint256[2]', name: 'tokenBalances' },
  { type: 'uint256[4]', name: 'pendingWeiUpdates' },
  { type: 'uint256[4]', name: 'pendingTokenUpdates' },
  { type: 'uint256[2]', name: 'txCount' },
  { type: 'bytes32', name: 'threadRoot' },
  { type: 'uint256', name: 'threadCount' },
]
const eventName = `DidUpdateChannel`
const sampleAddress = "0x0bfa016abfa8f627654b4989da4620271dc77b1c"
const sampleAddress2 = "0x17b105bcb3f06b3098de6eed0497a3e36aa72471"
const sampleAddress3 = "0x23a1e8118EA985bBDcb7c40DE227a9880a79cf7F"
const hubAddress = "0xFB482f8f779fd96A857f1486471524808B97452D"

/* Overrides for these fns function must be in the contract format
as they are used in solidity decoding. Returns tx with default deposit
values of all 5s
*/
function createMockedWithdrawalTxReceipt(sender: "user" | "hub", web3: Web3T, ...overrides: any[]) {
  const vals = generateTransactionReceiptValues({
    senderIdx: sender === "user" ? '1' : '0', // default to user wei deposit 5
    pendingWeiUpdates: ['0', '5', '0', '5'],
    pendingTokenUpdates: ['0', '5', '0', '5'],
  }, overrides)

  return createMockedTransactionReceipt(web3, vals)
}

function createMockedDepositTxReceipt(sender: "user" | "hub", web3: Web3T, ...overrides: any[]) {
  const vals = generateTransactionReceiptValues({
    senderIdx: sender === "user" ? '1' : '0', // default to user wei deposit 5
    pendingWeiUpdates: ['5', '0', '5', '0'],
    pendingTokenUpdates: ['5', '0', '5', '0'],
  }, overrides)

  return createMockedTransactionReceipt(web3, vals)
}

function generateTransactionReceiptValues(...overrides: any[]) {
  return Object.assign({
    user: sampleAddress,
    senderIdx: '1', // default to user wei deposit 5
    weiBalances: ['0', '0'],
    tokenBalances: ['0', '0'],
    pendingWeiUpdates: ['0', '0', '0', '0'],
    pendingTokenUpdates: ['0', '0', '0', '0'],
    txCount: ['1', '1'],
    threadRoot: EMPTY_ROOT_HASH,
    threadCount: '0',
  }, ...overrides)
}

function createMockedTransactionReceipt(web3: Web3T, vals: any) {
  const eventTopic = web3.eth.abi.encodeEventSignature({
    name: eventName,
    type: 'event',
    inputs: eventInputs,
  })

  const addrTopic = web3.eth.abi.encodeParameter('address', vals.user)

  const { user, ...nonIndexed } = vals

  const nonIndexedTypes = eventInputs.filter(val => Object.keys(val).indexOf('indexed') === -1).map(e => e.type)

  const data = web3.eth.abi.encodeParameters(nonIndexedTypes, Object.values(nonIndexed))

  // TODO: replace indexed fields
  // so you can also overwrite the indexed fields

  return {
    status: true,
    contractAddress: t.mkAddress('0xCCC'),
    transactionHash: t.mkHash('0xHHH'),
    logs: [{
      data: web3.utils.toHex(data),
      topics: [eventTopic, addrTopic]
    }]
  }
}

function createPreviousChannelState(...overrides: t.PartialSignedOrSuccinctChannel[]) {
  const state = t.getChannelState('empty', Object.assign({
    user: sampleAddress,
    sigUser: t.mkHash('booty'),
    sigHub: t.mkHash('errywhere'),
  }, ...overrides))
  return convertChannelState("bn", state)
}

function createThreadPaymentArgs(...overrides: Partial<PaymentArgs<any>>[]) {
  const { recipient, ...amts } = createPaymentArgs(...overrides)
  return amts
}

function createPaymentArgs(
  ...overrides: Partial<PaymentArgs<any>>[]
): PaymentArgsBN {
  const args = Object.assign({
    amountWei: '0',
    amountToken: '0',
    recipient: "user",
  }, ...overrides) as any

  return convertPayment("bn", { ...convertPayment("str", args) })
}

function createProposePendingArgs(overrides?: Partial<PendingArgs<number>>): PendingArgsBN {
  const res = {
    recipient: '0x1234',
    timeout: 0,
  } as PendingArgs
  proposePendingNumericArgs.forEach((a: string) => (res as any)[a] = 0)
  return convertProposePending('bn', {
    ...res,
    ...(overrides || {}),
  })
}

function createThreadState(...overrides: t.PartialSignedOrSuccinctThread[]) {
  let opts = Object.assign({}, ...overrides)
  const thread = t.getThreadState("empty", {
    sigA: t.mkHash('0xtipz'),
    balanceWei: [5, 0],
    balanceToken: [5, 0],
    receiver: t.mkAddress('0xAAA'),
    sender: sampleAddress,
    ...opts
  })
  return convertThreadState("bn", thread)
}

/*
 Use this function to create an arbitrary number of thread states as indicated by the targetThreadCount parameter. Override each thread state that gets returned with provided override arguments. Example usage and output:

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
function createChannelThreadOverrides(targetThreadCount: number, ...overrides: any[]) {
  const utils = new Utils()
  if (!targetThreadCount) {
    return {
      threadCount: 0,
      initialThreadStates: [],
      threadRoot: EMPTY_ROOT_HASH
    }
  }

  let initialThreadStates = [] as ThreadState[]
  for (let i = 0; i < targetThreadCount; i++) {
    initialThreadStates.push(convertThreadState("str", createThreadState(Object.assign({
      receiver: t.mkAddress(`0x${i + 1}`),
      threadId: 69 + i,
      txCount: 0,
    }, ...overrides)
    )))
  }
  return {
    threadCount: targetThreadCount,
    initialThreadStates,
    threadRoot: utils.generateThreadRootHash(initialThreadStates)
  }
}

describe('validator', () => {
  const web3 = new Web3('http://localhost:8545') /* NOTE: all functional aspects of web3 are mocked */
  const validator = new Validator(web3, hubAddress)

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
      weiToSell: toBN(1),
      tokensToSell: toBN(0),
      exchangeRate: '5',
      seller: "user"
    }

    let baseTokenToWei = {
      weiToSell: toBN(0),
      tokensToSell: toBN(5),
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
        args: { ...baseWeiToToken, weiToSell: toBN(0) },
        valid: false,
      },
      {
        name: 'should return a string if neither toSell values are zero',
        prev,
        args: { ...baseWeiToToken, tokensToSell: toBN(1) },
        valid: false,
      },
      {
        name: 'should return a string if negative wei to sell is provided',
        prev,
        args: { ...baseWeiToToken, weiToSell: toBN(-5) },
        valid: false,
      },
      {
        name: 'should return a string if negative tokens to sell is provided',
        prev,
        args: { ...baseTokenToWei, tokensToSell: toBN(-5) },
        valid: false,
      },
      {
        name: 'should return a string if seller cannot afford tokens for wei exchange',
        prev,
        args: { ...baseTokenToWei, tokensToSell: toBN(10) },
        valid: false,
      },
      {
        name: 'should return a string if seller cannot afford wei for tokens exchange',
        prev,
        args: { ...baseWeiToToken, weiToSell: toBN(10) },
        valid: false,
      },
      {
        name: 'should return a string if payor cannot afford wei for tokens exchange',
        prev,
        args: { ...baseWeiToToken, weiToSell: toBN(2), },
        valid: false,
      },
      {
        name: 'should return a string if payor as hub cannot afford tokens for wei exchange',
        prev: { ...prev, balanceWeiHub: toBN(0) },
        args: { ...baseTokenToWei, weiToSell: toBN(10) },
        valid: false,
      },
      {
        name: 'should return a string if payor as user cannot afford tokens for wei exchange',
        prev: { ...prev, balanceWeiUser: toBN(0) },
        args: { ...baseTokenToWei, weiToSell: toBN(10), seller: "user" },
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
      depositWeiHub: toBN(1),
      depositWeiUser: toBN(1),
      depositTokenHub: toBN(1),
      depositTokenUser: toBN(1),
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
        prev: { ...prev, pendingDepositWeiUser: toBN(5) },
        args,
        valid: false
      },
      {
        name: 'should return a string for negative deposits',
        prev,
        args: { ...args, depositWeiUser: toBN(-5) },
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
        prev: { ...prev, pendingDepositWeiUser: toBN(10) },
        args,
        valid: false
      },
      {
        name: 'should return a string if the args have a negative value',
        prev,
        args: { ...args, weiToSell: toBN(-5) },
        valid: false
      },
      {
        name: 'should return a string if resulting state has negative values',
        prev,
        args: { ...args, tokensToSell: toBN(20) },
        valid: false
      },
      {
        name: 'should return a string if the args result in an invalid transition',
        prev,
        args: { ...args, weiToSell: toBN(10), tokensToSell: toBN(0), additionalWeiHubToUser: toBN(30) },
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
    const depositReceipt = createMockedDepositTxReceipt("user", web3)
    const wdReceipt = createMockedWithdrawalTxReceipt("user", web3)

    const prevDeposit = createPreviousChannelState({
      pendingDepositToken: [5, 5],
      pendingDepositWei: [5, 5],
    })
    const prevWd = createPreviousChannelState({
      pendingWithdrawalToken: [5, 5],
      pendingWithdrawalWei: [5, 5],
    })

    const tx = {
      blockHash: t.mkHash('0xBBB'),
      to: prevDeposit.contractAddress,
    }

    const confirmCases = [
      {
        name: 'should work for deposits',
        prev: prevDeposit,
        stubs: [tx, depositReceipt],
        valid: true,
      },
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
        stubs: [tx, createMockedDepositTxReceipt("hub", web3)],
        valid: false,
      },
      // {
      //   name: 'should return a string if balance wei hub is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceWeiHub: toBN(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should return a string if balance wei user is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceWeiUser: toBN(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should return a string if balance token hub is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceTokenHub: toBN(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      // {
      //   name: 'should return a string if balance token user is not same in receipt and previous',
      //   prev: { ...prevDeposit, balanceTokenUser: toBN(5) },
      //   stubs: [tx, depositReceipt],
      //   valid: false,
      // },
      {
        name: 'should return a string if pending deposit wei hub is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositWeiHub: toBN(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending deposit wei user is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositWeiUser: toBN(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending deposit token hub is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositTokenHub: toBN(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending deposit token user is not same in receipt and previous',
        prev: { ...prevDeposit, pendingDepositTokenUser: toBN(3) },
        stubs: [tx, depositReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending withdrawal wei hub is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalWeiHub: toBN(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending withdrawal wei user is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalWeiUser: toBN(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending withdrawal token hub is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalTokenHub: toBN(10) },
        stubs: [tx, wdReceipt],
        valid: false,
      },
      {
        name: 'should return a string if pending withdrawal token user is not same in receipt and previous',
        prev: { ...prevWd, pendingWithdrawalTokenUser: toBN(10) },
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
    ]

    confirmCases.forEach(async ({ name, prev, stubs, valid }) => {
      // TODO: reenable these! watch issue here for correspondence with maintainer: https://github.com/ethereum/web3.js/issues/2344
      it.skip(name, async () => {
        // set tx receipt stub
        validator.web3.eth.getTransaction = sinon.stub().returns(stubs[0])
        validator.web3.eth.getTransactionReceipt = sinon.stub().returns(stubs[1])
        // set args
        const transactionHash = stubs[1] && (stubs[1] as any).transactionHash === depositReceipt.transactionHash ? depositReceipt.transactionHash : wdReceipt.transactionHash
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
        prev: { ...prev, pendingDepositWeiUser: toBN(5) },
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
        args: { ...args, balanceWeiReceiver: toBN(2) },
        message: `There were 1 non-zero fields detected (detected fields and values: [{"field":"balanceWeiReceiver"`,
      },
      {
        name: 'should fail if the receiver token balance is greater than zero',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceTokenReceiver: toBN(2) },
        message: `There were 1 non-zero fields detected (detected fields and values: [{"field":"balanceTokenReceiver"`,
      },
      {
        name: 'should return a string if the receiver wei balance is less than zero',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceWeiReceiver: toBN(-2) },
        message: `There were 1 non-zero fields detected (detected fields and values: [{"field":"balanceWeiReceiver"`,
      },
      {
        name: 'should return a string if the receiver token balance is less than zero',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceTokenReceiver: toBN(-2) },
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
        args: { ...args, balanceWeiSender: toBN(20), balanceTokenSender: toBN(20), receiver: sampleAddress, sender: t.mkAddress("0X111")},
        message: "Hub does not have sufficient Token, Wei balance",
      },
      {
        name: 'should return a string if the thread sender (as user) cannot afford to create the thread',
        prev,
        initialThreadStates,
        sigErr: false,
        args: { ...args, balanceWeiSender: toBN(20), balanceTokenSender: toBN(20) },
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
        args: {...args, contractAddress: emptyAddress},
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
        args: { ...args, balanceWeiSender: toBN(10) },
        sigErr: false,
        message: 'There were 1 non-equivalent fields detected (detected fields and values: [{"field":"weiSum"',
      },
      {
        name: 'should return a string if the final state token balance is not conserved',
        prev,
        initialThreadStates,
        args: { ...args, balanceTokenSender: toBN(10) },
        sigErr: false, // stubs out sig recover in tests
        message: 'There were 1 non-equivalent fields detected (detected fields and values: [{"field":"tokenSum"',
      },
      {
        name: 'should return a string if the receiver wei balances are negative',
        prev,
        initialThreadStates,
        args: {...args, balanceWeiReceiver: toBN(-10) },
        sigErr: false,
        message: 'There were 1 negative fields detected (detected fields and values: [{"field":"balanceWeiReceiver"'
      }, 
      {
        name: 'should return a string if the receiver token balances are negative',
        prev,
        initialThreadStates,
        args: {...args, balanceTokenReceiver: toBN(-10) },
        sigErr: false,
        message: 'There were 1 negative fields detected (detected fields and values: [{"field":"balanceTokenReceiver"'
      }, 
      {
        name: 'should return a string if the sender wei balances are negative',
        prev,
        initialThreadStates,
        args: {...args, balanceWeiSender: toBN(-10) },
        sigErr: false,
        message: 'There were 1 negative fields detected (detected fields and values: [{"field":"balanceWeiSender"'
      }, 
      {
        name: 'should return a string if the sender token balances are negative',
        prev,
        initialThreadStates,
        args: {...args, balanceTokenSender: toBN(-10) },
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
      weiToSell: toBN(0),
      tokensToSell: toBN(0),
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
          tokensToSell: toBN(2),
          withdrawalTokenUser: toBN(3),
        },
        valid: true,
      },

      {
        name: 'exchange + withdrawal makes balance negative',
        prev,
        args: {
          ...args,
          tokensToSell: toBN(4),
          withdrawalTokenUser: toBN(4),
        },
        valid: false,
      },

      {
        name: 'hub withdraws sold tokens',
        prev,
        args: {
          ...args,
          tokensToSell: toBN(5),
          withdrawalTokenHub: toBN(7),
        },
        valid: true,
      },

      {
        name: 'user withdraws purchased wei',
        prev,
        args: {
          ...args,
          tokensToSell: toBN(4),
          withdrawalWeiUser: toBN(7),
        },
        valid: true,
      },

    ]

    proposePendingExchangeCases.forEach(runCase)

    describe('with pending cases', () => {
      getProposePendingCases().forEach(tc => {
        runCase({ ...tc, args: { ...args, weiToSell: toBN(1), ...tc.args } })
      })
    })

    describe('with exchange cases', () => {
      getExchangeCases().forEach(tc => {
        runCase({ ...tc, args: { ...args, ...tc.args as ExchangeArgsBN } })
      })
    })
  })

  describe.skip('threadPayment', () => {
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
