import { convertChannelState, convertWithdrawal } from "../types";
import * as t from './index'

import BN = require('bn.js') // no import means ts errs?

const fs = require("fs");

/*
  Overrides are only those consistent with withdrawal balances changes
  Returns list of objects with the form:
  [{ args: { exchangeRate: '5',
    tokensToSell: 5,
    weiToSell: 0,
    withdrawalWeiUser: 1,
    withdrawalTokenUser: 0,
    withdrawalWeiHub: 1,
    withdrawalTokenHub: 5,
    depositWeiHub: 0,
    depositTokenHub: 0,
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
    const path = fileDir ? fileDir + '/withdrawal-states.json' : __dirname + '/withdrawal-states.json'
    return JSON.parse(fs.readFileSync(path))
}

function createChannelState(type: string, ...overrides: t.PartialSignedOrSuccinctChannel[]) {
    const state = t.getChannelState('empty', {
        ...overrides[0],
        sigHub: t.mkHash('sigH'),
        sigUser: t.mkHash('sigU')
    })
    return convertChannelState(type as any, state)
}

function createWithdrawalArgs(type: string, ...overrides: t.PartialVerboseOrSuccintWithdrawalArgs[]) {
    let args = t.getWithdrawalArgs('empty', {
        ...overrides[0]
    })
    args.timeout = Number(args.timeout) // TODO fix better
    args.exchangeRate = args.exchangeRate.toString()
    return convertWithdrawal(type as any, args)
}

type PartialRequest = Partial<{
    wei: number | string,
    token: number | string
}>
type Overrides = {
    target: "curr" | "prev" | "request" | "args",
    overrides: t.PartialSignedOrSuccinctChannel[] | t.PartialVerboseOrSuccintWithdrawalArgs[] | PartialRequest[] // TODO: should be partial of any of the succinct partials
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
    type: "bn" | "bignumber" | "str",
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

    const request = { ...wdOverrides.request, ...reqOverrides }

    const args = createWithdrawalArgs(type, { ...wdOverrides.args, ...argsOverrides })
    return { prev, curr, request, args }
}