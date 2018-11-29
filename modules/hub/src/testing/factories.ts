import { TestServiceRegistry } from ".";
import { getChannelState, mkAddress, getThreadState, PartialSignedOrSuccinctChannel, PartialSignedOrSuccinctThread } from "./stateUtils";
import { default as ChannelsDao } from "../dao/ChannelsDao";
import { Big } from "../util/bigNumber";
import { default as ThreadsDao } from "../dao/ThreadsDao";
import { ChannelUpdateReason, ChannelState } from "../vendor/connext/types";
import BN = require('bn.js')
import ExchangeRateDao from "../dao/ExchangeRateDao";

export function tokenVal(x: number | string): string {
  return Big(x).mul(1e18).toFixed()
}

/**
 * Creates a channel for a user.
 */
export async function channelUpdateFactory(
  registry: TestServiceRegistry,
  reason: ChannelUpdateReason,
  opts?: PartialSignedOrSuccinctChannel
) {
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const state = getChannelState('signed', opts || {})
  const update = await channelsDao.applyUpdateByUser(state.user, reason, state.user, state)
  return {
    update,
    state,
    user: state.user,
  }
}

export function channelNextState(prevState: ChannelState, next: PartialSignedOrSuccinctChannel) {
  return {
    ...prevState,
    txCountGlobal: prevState.txCountGlobal + 1,
    ...next,
  }
}

/**
 * Creates user and performer channels, and opens a thread between the user
 * and the performer.
 */
export async function channelAndThreadFactory(registry: TestServiceRegistry, sender?: string, receiver?: string) {
  const threadsDao: ThreadsDao = registry.get('ThreadsDao')

  // open performer channel
  const perf = await channelUpdateFactory(registry, 'ConfirmPending', {
    user: receiver || mkAddress('0xf'),
  })

  // open user channel
  const user = await channelUpdateFactory(registry, 'OpenThread', {
    user: sender || mkAddress('0xb'),
    balanceTokenUser: tokenVal(69),
  })

  let thread = getThreadState('signed', {
    sender: user.user,
    receiver: perf.user,
    balanceTokenSender: tokenVal(10),
  })
  await threadsDao.applyThreadUpdate(thread, user.update.id)

  return {
    user: user.user,
    performer: perf.user,
  }
}

export async function exchangeRateFactory(registry: TestServiceRegistry, exchangeRate?: string) {
  const exchRateDao: ExchangeRateDao = registry.get('ExchangeRateDao')

  const rate = exchangeRate || '123.45'
  await exchRateDao.record(Date.now(), rate)
  return rate
}