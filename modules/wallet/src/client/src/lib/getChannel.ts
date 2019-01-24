import { ConnextStore } from '../state/store'
import { ChannelState } from '../types'

export function getChannel(store: ConnextStore): ChannelState {
  return store.getState().persistent.channel
}
