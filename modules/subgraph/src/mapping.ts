import { DidUpdateChannel } from './types/ChannelManager/ChannelManager'
import { Channel } from './types/schema'

export function handleDidUpdateChannel(event: DidUpdateChannel): void {
  let id = event.params.user.toHex()
  let channel = Channel.load(id)
  if (channel == null) {
    channel = new Channel(id)
  }

  let balanceWei = event.params.weiBalances
  channel.user = event.params.user.toHex()
  channel.balanceWeiHub = balanceWei[0]
  channel.balanceWeiUser = balanceWei[1]

  let balanceToken = event.params.tokenBalances
  channel.balanceTokenHub = balanceToken[0]
  channel.balanceTokenUser = balanceToken[1]

  let pendingWeiUpdates = event.params.pendingWeiUpdates
  channel.pendingDepositWeiHub = pendingWeiUpdates[0]
  channel.pendingWithdrawalWeiHub = pendingWeiUpdates[1]
  channel.pendingDepositWeiUser = pendingWeiUpdates[2]
  channel.pendingWithdrawalWeiUser = pendingWeiUpdates[3]

  let pendingTokenUpdates = event.params.pendingTokenUpdates
  channel.pendingDepositTokenHub = pendingTokenUpdates[0]
  channel.pendingWithdrawalTokenHub = pendingTokenUpdates[1]
  channel.pendingDepositTokenUser = pendingTokenUpdates[2]
  channel.pendingWithdrawalTokenUser = pendingTokenUpdates[3]
  channel.threadRoot = event.params.threadRoot.toHex()
  channel.threadCount = event.params.threadCount.toI32()
  channel.save()
}
