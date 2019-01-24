#!/usr/bin/env node
/**
 * Generates a list of all the possible types of withdrawal that can be
 * performed (for example, a "withdrawal that requests an exchange where the
 * hub does not have sufficient collatoral", or "withdrawal of just wei").
 */
const vm = require('vm')
const fs = require('fs')

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

function permutations(xs /* [[1, 2], [3, 4]] */) { /* [[1, 3], [1, 4], [2, 3], ...] */
  let res = []
  if (!xs.length)
    return res

  let rest = permutations(xs.slice(1))
  if (!rest.length)
    return xs[0]

  for (let cur of xs[0]) {
    for (let r of rest)
      res.push([cur].concat(r))
  }

  return res
}


function generatePermutations(defs /* name: transform */, bitOffset) { /* [[transform, transform], ...] */
  let positions = [] // [[transform, transform], [transform, ...], ...]
  for (let [name, transform] of Object.entries(defs)) {
    let bits = name.replace('[', '').replace(']', '').split(',') // ['+', '_', '_']
    let idx = null
    let bit = null
    bits.forEach((b, i) => {
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

function applyTransform(ctx, transform) {
  for (let key of ['prev', 'request']) {
    if (!transform[key])
      continue
    vm.runInNewContext(`${key}.${transform[key].replace(':', ' =')}`, ctx)
  }
  return ctx
}

function applyTransforms(transforms) { /* { prev: { ...state... }, request: { wei: X, token: Y } } */
  let res = {
    Math: Math,
    prev: { ...defaultState },
    request: { ...defaultRequest },
    weiToTokenRate,
  }

  let name = []
  for (let transform of transforms) {
    res = applyTransform(res, transform)
    name[transform.idx] = transform.bit
  }

  delete res.Math
  res.name = `[${name.join(',')}]`
  res.desc = transforms.map(t => t.desc)
  return res
}

let cols = generatePermutations(colPermutations, 0)
let rows = generatePermutations(rowPermutations, 2)

let str = ''
let objs = []
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

    str = str + descStr + objStr
  }
}

console.log(str)
fs.writeFile('withdrawal-states.json', JSON.stringify(objs), (err) => {
  if (err) {
    console.log('error writing file...')
    console.log(err)
  }
})


const BOOTY_LIMIT = 69

function extractArgsAndCurrOverrides(obj) {
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
  // withdrawal in args is amount of wei from channel
  const withdrawalWeiHub = key[2] === '>' ? prev.balanceWeiHub : 0

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
        // hub has less than booty limit, leave tokens only to collat.
        depositTokenHub = prev.balanceTokenHub < totalTokenCollateral
          ? Math.min(totaltokenCollateral - prev.balanceTokenHub, BOOTY_LIMIT)
          : 0
        pendingWithdrawalTokenHub = totalTokenCollateral < prev.balanceTokenHub
          ? prev.balanceTokenHub - totalTokenCollateral
          : 0 // no withdrawal needed
        balanceTokenHub = Math.min(Math.abs(totaltokenCollateral - prev.balanceTokenHub), BOOTY_LIMIT)
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
      withdrawalWeiUser: request.wei, // wei from balance
      withdrawalTokenUser: 0, // no wd tokens
      withdrawalWeiHub, // wei from hub balance
      withdrawalTokenHub: pendingWithdrawalTokenHub - request.token, // tokens from hub balance
      depositWeiHub: 0, // doesnt collateralize token2wei xchange
      depositTokenHub, // amount needed for token collateral
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
