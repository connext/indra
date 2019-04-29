import * as Connext from '../Connext';
const vm = require('vm')
import { PartialSignedOrSuccinctChannel, getChannelState, mkAddress, mkSig } from './stateUtils'

type WithdrawalArgs = Connext.types.WithdrawalArgs
const { convertChannelState, convertWithdrawal, convertFields } = Connext.types

/**
 * Generates a list of all the possible types of withdrawal that can be
 * performed (for example, a "withdrawal that requests an exchange where the
 * hub does not have sufficient collatoral", or "withdrawal of just wei").
 */

const defaultState = {
  balanceWeiHub: 0,
  balanceWeiUser: 0,
  balanceTokenHub: 0,
  balanceTokenUser: 0,
  pendingDepositWeiHub: 0,
  pendingDepositWeiUser: 0,
  pendingDepositTokenHub: 0,
  pendingDepositTokenUser: 0,
  pendingWithdrawalWeiHub: 0,
  pendingWithdrawalWeiUser: 0,
  pendingWithdrawalTokenHub: 0,
  pendingWithdrawalTokenUser: 0,
}

const defaultRequest = {
  wei: 0,
  token: 0,
}

const weiToTokenRate = 5

const colPermutations = {
  '[+,_]': {
    desc: 'withdrawal requests wei from balance',
    prev: 'balanceWeiUser: 1',
    request: 'wei: 1',
  },
  '[0,_]': {
    desc: 'withdrawal does not request wei from balance',
    prev: 'balanceWeiUser: 0',
    request: 'wei: 0',
  },
  '[_,+]': {
    desc: 'withdrawal requests a token exchange',
    prev: 'balanceTokenUser: weiToTokenRate',
    request: 'token: weiToTokenRate',
  },
  '[_,0]': {
    desc: 'withdrawal does not request a token exchange',
    prev: 'balanceTokenUser: 0',
    request: 'token: 0',
  },
  // Note: these cases will rarely happen, and in every one of them the Hub's
  // response is:
  //   if (postWithdrawalState.totalBooty < Math.min(channelBootyLimit, weiToBooty(postWithdrawalState.totalUserWei)))
  //     postWithdrawalState = recollatoralize(postWithdrawalState)
  // '[_,_,0]': {
  //   desc: 'withdrawal leaves no wei in channel',
  //   prev: 'balanceWeiUser: 0',
  // },
  // '[_,_,+]': {
  //   desc: 'withdrawal leaves some wei <= booty limit in channel',
  //   prev: 'balanceWeiUser: request.wei + 1',
  // },
  // '[_,_,>]': {
  //   desc: 'withdrawal leaves some wei > booty limit in channel',
  //   prev: 'balanceWeiUser: request.wei + 100',
  // },
}

const rowPermutations = {
  '[<,_]': {
    desc: 'hub has insufficient wei to exchange for requested booty amount',
    prev: 'balanceWeiHub: Math.max(0, request.token / weiToTokenRate - request.wei)',
  },
  '[=,_]': {
    desc: 'hub will end up with 0 wei after exchanging for requested booty amount',
    prev: 'balanceWeiHub: request.token / weiToTokenRate',
  },
  '[>,_]': {
    desc: 'hub will end up with a surplus of wei after exchanging for requested booty amount',
    prev: 'balanceWeiHub: request.token / weiToTokenRate + 1',
  },
  '[_,0]': {
    desc: 'hub has no tokens',
    prev: 'balanceTokenHub: 0',
  },
  '[_,+]': {
    desc: 'hub has tokens <= booty limit in channel',
    prev: 'balanceTokenHub: weiToTokenRate',
  },
  '[_,>]': {
    desc: 'hub has tokens > booty limit in channel',
    prev: 'balanceTokenHub: 100',
  },
}


function permutations(xs: any /* [[1, 2], [3, 4]] */) { /* [[1, 3], [1, 4], [2, 3], ...] */
  let res: any = []
  if (!xs.length)
    return res

  let rest = permutations(xs.slice(1))
  if (!rest.length)
    return xs[0].map((x: any) => [x])

  for (let cur of xs[0]) {
    for (let r of rest)
      res.push([cur].concat(r))
  }

  return res
}


function generatePermutations(defs: any /* name: transform */, bitOffset: any) { /* [[transform, transform], ...] */
  let positions: any = [] // [[transform, transform], [transform, ...], ...]
  for (let [name, transform] of Object.entries(defs) as any) {
    let bits = name.replace('[', '').replace(']', '').split(',') // ['+', '_', '_']
    let idx: any = null
    let bit = null
    bits.forEach((b: any, i: any) => {
      if (b == '_')
        return
      if (idx !== null)
        throw new Error('Name has multiple defined bits: ' + name)
      idx = i
      bit = b
    })

    if (!positions[idx])
      positions[idx] = []

    transform.idx = idx + bitOffset
    transform.bit = bit
    positions[idx].push(transform)
  }

  return permutations(positions)
}

function applyTransform(ctx: any, transform: any) {
  for (let key of ['prev', 'request']) {
    if (!transform[key])
      continue
    vm.runInNewContext(`${key}.${transform[key].replace(':', ' =')}`, ctx)
  }
  return ctx
}

function applyTransforms(transforms: any) { /* { prev: { ...state... }, request: { wei: X, token: Y } } */
  let res = {
    Math: Math,
    prev: { ...defaultState },
    request: { ...defaultRequest },
    weiToTokenRate,
    name: '',
    desc: [],
  }

  let name = []
  for (let transform of transforms) {
    res = applyTransform(res, transform)
    name[transform.idx] = transform.bit
  }

  delete res.Math
  res.name = `[${name.join(',')}]`
  res.desc = transforms.map((t: any) => t.desc)
  return res
}

let cols = generatePermutations(colPermutations, 0)
let rows = generatePermutations(rowPermutations, 2)

let objs = [] as any[]
for (let col of cols) {
  for (let row of rows) {
    let state = applyTransforms(col.concat(row))

    // Ignore states which don't request either a wei withdrawal or token exchange
    if (state.name.startsWith('[0,0'))
      continue

    const { args, curr } = extractArgsAndCurrOverrides(state)
    const descStr = '\n' + state.desc.join('\n') + '\n'
    const objStr = `${state.name}: ${JSON.stringify({ prev: state.prev, request: state.request, args, curr })}` + '\n'

    objs.push({ args, curr, prev: state.prev, request: state.request, desc: descStr, name: state.name })
  }
}

const BOOTY_LIMIT = 69

function extractArgsAndCurrOverrides(obj: any) {
  const { request, prev, name } = obj
  const key = name.substring(1).split(',')
  const exchangeRate = weiToTokenRate
  // does user wei balance update from requested withdrawal
  const balanceWeiUser = key[0] === '+' ? prev.balanceWeiUser - request.wei : prev.balanceWeiUser
  // calculate amount of potential tokens exchanged from remaining wei
  const totalTokenCollateral = balanceWeiUser / exchangeRate

  // does withdrawal request token exchange
  const balanceTokenUser = key[1] === '+' ? prev.balanceTokenUser - request.token : prev.balanceTokenUser

  // calculate the equivalent wei
  const weiExchangedWd = key[1] === '+' ? request.token / exchangeRate : 0

  // does hub need to deposit wei for requested token exchange
  const weiCollateralDeposit = key[2] === '<' ? weiExchangedWd : 0

  // hub wei withdrawal is nonzero if there is a surplus of wei after exchanging
  // hub reclaims all wei possible on withdrawals
  const pendingWithdrawalWeiHub = key[2] === '>' ? prev.balanceWeiHub : 0

  let depositTokenHub = 0
  let pendingWithdrawalTokenHub = 0
  let balanceTokenHub = 0
  // are there collateral needs for the user
  if (balanceWeiUser > 0) {
    switch (key[3]) {
      case '>':
        // hub has more than booty limit, deposit 0
        // hub token balance to just enough for exchange up to limit
        balanceTokenHub = Math.min(totalTokenCollateral, BOOTY_LIMIT)
        pendingWithdrawalTokenHub = prev.balanceTokenHub - balanceTokenHub
        break
      case '+':
        // hub has less than booty limit, leave tokens only to colla
        depositTokenHub = prev.balanceTokenHub < totalTokenCollateral
          ? Math.min(totalTokenCollateral - prev.balanceTokenHub, BOOTY_LIMIT)
          : 0
        pendingWithdrawalTokenHub = totalTokenCollateral < prev.balanceTokenHub
          ? prev.balanceTokenHub - totalTokenCollateral
          : 0 // no withdrawal needed
        balanceTokenHub = Math.min(Math.abs(totalTokenCollateral - prev.balanceTokenHub), BOOTY_LIMIT)
        break
      case '0':
        // hub has no tokens after xchange, withdraw 0, balance is 0
        depositTokenHub = Math.min(totalTokenCollateral, BOOTY_LIMIT)
        break
      default:
        break
    }
  } else {
    // user has 0 wei, hub should have 0 tokens
    // hub should withdraw total balance
    pendingWithdrawalTokenHub = prev.balanceTokenHub + request.token
  }

  return {
    args: {
      exchangeRate: exchangeRate.toString(),
      tokensToSell: request.token,
      weiToSell: 0, // no wei exchanges on wd
      recipient: '0x2220000000000000000000000000000000000000',
      targetWeiUser: balanceWeiUser,
      targetTokenUser: balanceTokenUser,
      targetWeiHub: 0,
      targetTokenHub: balanceTokenHub,
      additionalWeiHubToUser: 0, // additional recipient payments
      additionalTokenHubToUser: 0, // not yet supported
      timeout: 6969,
    },
    curr: {
      recipient: '0x2220000000000000000000000000000000000000',
      pendingDepositWeiHub: 0, // dont collateralize token2wei
      pendingDepositWeiUser: weiCollateralDeposit,
      pendingDepositTokenHub: depositTokenHub,
      pendingDepositTokenUser: 0, // dont deposit tokens on wd
      pendingWithdrawalWeiUser: weiExchangedWd + request.wei,
      pendingWithdrawalWeiHub,
      pendingWithdrawalTokenHub,
      pendingWithdrawalTokenUser: 0, // cant wd tokens
      balanceWeiHub: 0, // dont collateralize token2wei exchanges
      balanceWeiUser,
      balanceTokenHub,
      balanceTokenUser,
      timeout: 6969,
    }
  }
}


/*
  Overrides are only those consistent with withdrawal balances changes
  Returns list of objects with the form:
  [{ args: { exchangeRate: '5',
    tokensToSell: 5,
    weiToSell: 0,
    additionalWeiHubToUser: 0,
    additionalTokenHubToUser: 0 },
    curr:
    { pendingDepositWeiUser: 0,
        pendingWithdrawalWeiHub: 2,
        pendingDepositTokenHub: 0,
        balanceWeiHub: 0,
        balanceWeiUser: 0,
        balanceTokenHub: 0,
        balanceTokenUser: 0 },
    prev:
    { balanceWeiHub: 3,
        balanceWeiUser: 1,
        balanceTokenHub: 5,
        balanceTokenUser: 5,
        pendingDepositWeiHub: 0,
        pendingDepositWeiUser: 0,
        pendingDepositTokenHub: 0,
        pendingDepositTokenUser: 0,
        pendingWithdrawalWeiHub: 0,
        pendingWithdrawalWeiUser: 0,
        pendingWithdrawalTokenHub: 0,
        pendingWithdrawalTokenUser: 0 },
    request: { wei: 1, token: 5 },
    desc: '\nwithdrawal requests wei from balance\nwithdrawal requests a token exchange\nhub will end up with a surplus of wei after exchanging for requested booty amount\nhub has tokens <= bootylimit in channel\n',
    name: '[+,+,>,+]' },
    ...
   ]

    Designed to be used with testing functions in client to properly generate
    states. JSON output is the output of: camsite/hub/development/generate-withdrawal-states
*/

export function extractWithdrawalOverrides(fileDir?: string): any[] {
    return objs
}

function createChannelState(type: string, ...overrides: PartialSignedOrSuccinctChannel[]) {
    const state = getChannelState('empty', {
        ...overrides[0],
        sigHub: mkSig('0x5151'),
        sigUser: mkSig('0x5252')
    })
    return convertChannelState(type as any, state)
}

function createWithdrawalArgs(type: string, overrides: WithdrawalArgs) {
    let args: WithdrawalArgs = {
        exchangeRate: '5', // wei to token
        tokensToSell: '0',
        weiToSell: '0',
        recipient: mkAddress('0x222'),
        additionalWeiHubToUser: '0',
        additionalTokenHubToUser: '0',
        timeout: 6969,
        ...overrides,
    }
    args.timeout = +args.timeout
    args.exchangeRate = args.exchangeRate.toString()
    return convertWithdrawal(type as any, args)
}

type PartialRequest = Partial<{
    wei: number | string,
    token: number | string
}>
type Overrides = {
    target: "curr" | "prev" | "request" | "args",
    overrides: WithdrawalArgs
}

/** 
 * generates states and args of indicated type from given withdrawal override obj
can also specify specific overrides
wdOverrides have form described at top of file.

Designed to be used in a function like this:

> const wds = extractWithdrawalOverrides()
> const params = createWithdrawalParams(wd[0], "bn", [ target: "curr", { balanceWei: [ 10, 10 ]}])

The resultant params will have the same structure as a withdrawal override (top of file), but the fields specified in the custom overrides will be applied at the end of the generation.

If no custom overrides are provided, the default withdrawal states, args, and requests will be generated for use in tests
*/


export function createWithdrawalParams(
    wdOverrides: any,
    type: "bn" | "str",
    customOverrides?: Overrides[]
) {
    if (!customOverrides) {
        customOverrides = [{} as any]
    }

    // use custom overrides by key to create correct type
    const prevOverrides = customOverrides.filter(o => o.target === "prev")
    const currOverrides = customOverrides.filter(o => o.target === "curr")
    const argsOverrides = customOverrides.filter(o => o.target === "args")
    const reqOverrides = customOverrides.filter(o => o.target === "request")

    const prev = createChannelState(type, { ...wdOverrides.prev, ...prevOverrides })

    const curr = createChannelState(type + "-unsigned", {
        ...wdOverrides.curr,
        ...currOverrides,
        txCount: [prev.txCountGlobal + 1, prev.txCountChain + 1],
    })

    const request = convertFields(
      // should be string or number
      (typeof wdOverrides.request.token).toString() as any, 
      type, 
      ["token", "wei"], 
      { ...wdOverrides.request, ...reqOverrides }
    )

    const args = createWithdrawalArgs(type, { ...wdOverrides.args, ...argsOverrides })
    return { prev, curr, request, args }
}
