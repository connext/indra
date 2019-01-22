import { ChannelState } from './types'

export function hasPendingOps(state: ChannelState) {
  for (let field in state) {
    if (!field.startsWith('pending'))
      continue
    if ((state as any)[field] != '0')
      return true
  }
  return false
}

