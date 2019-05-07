import { StateGenerator, types, big } from 'connext';
import { TestServiceRegistry } from ".";
import { getChannelState, mkAddress, getThreadState, PartialSignedOrSuccinctChannel } from "./stateUtils";
import { default as ChannelsDao } from "../dao/ChannelsDao";
import { default as ThreadsDao } from "../dao/ThreadsDao";
import ExchangeRateDao from "../dao/ExchangeRateDao";

type ChannelUpdateReason = types.ChannelUpdateReason
type ChannelState = types.ChannelState
type PaymentArgs = types.PaymentArgs
type ArgsTypes = types.ArgsTypes

const { convertChannelState, convertThreadState } = types

export function tokenVal(x: number | string): string {
  return big.toWeiString(x)
}

/**
 * Creates a channel for a user.
 */
export async function channelUpdateFactory(
  registry: TestServiceRegistry,
  opts?: PartialSignedOrSuccinctChannel,
  reason: ChannelUpdateReason = 'ConfirmPending',
  args?: ArgsTypes
) {
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const state = getChannelState('signed', opts || {})
  const update = await channelsDao.applyUpdateByUser(state.user, reason, state.user, state, args || {})
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

  // open user channel
  let user = await channelUpdateFactory(registry, {
    user: sender || mkAddress('0xb'),
    balanceTokenUser: tokenVal(69),
  })

  // open performer channel
  let perf = await channelUpdateFactory(registry, {
    user: receiver || mkAddress('0xf'),
    balanceTokenHub: tokenVal(69),
  })

  let thread = getThreadState('signed', {
    sender: user.user,
    receiver: perf.user,
    balanceTokenSender: tokenVal(10),
  })

  const sg = new StateGenerator()
  const userUpdate = await sg.openThread(
    convertChannelState('bn', user.state),
    [],
    convertThreadState('bn', thread)
  )
  user = await channelUpdateFactory(registry, userUpdate)

  const perfUpdate = await sg.openThread(
    convertChannelState('bn', perf.state),
    [],
    convertThreadState('bn', thread)
  )
  perf = await channelUpdateFactory(registry, perfUpdate)

  await threadsDao.applyThreadUpdate(thread, user.update.id)

  return {
    user,
    performer: perf,
    thread
  }
}

export async function exchangeRateFactory(registry: TestServiceRegistry, exchangeRate?: string) {
  const exchRateDao: ExchangeRateDao = registry.get('ExchangeRateDao')

  const rate = exchangeRate || '123.45'
  await exchRateDao.record(Date.now(), rate)
  return rate
}
