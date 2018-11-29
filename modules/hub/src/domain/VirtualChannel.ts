import { BigNumber } from 'bignumber.js'
import { VcStatus } from '../dao/VirtualChannelsDao'

export interface VirtualChannelDto {
  channelId: string
  partyA: string
  partyB: string
  partyI: string
  subchanAtoI: string
  subchanBtoI: string
}

export interface VcStateUpdateDto {
  nonce: number
  ethBalanceA: BigNumber
  ethBalanceB: BigNumber
  tokenBalanceA: BigNumber
  tokenBalanceB: BigNumber
  priceWei?: BigNumber
  priceToken?: BigNumber
  sigA?: string
  sigB?: string
}

// Note: this has been coppied to vynos/lib/connext/ConnextTypes.ts
export interface VcStateUpdate {
  id: number
  channelId: string
  nonce: number
  ethBalanceA: BigNumber
  ethBalanceB: BigNumber
  tokenBalanceA: BigNumber
  tokenBalanceB: BigNumber
  priceWei?: BigNumber
  priceToken?: BigNumber
  sigA?: string
  sigB?: string
  createdAt: number
}

export interface VirtualChannel {
  state: VcStatus
  ethBalanceA: BigNumber
  ethBalanceB: BigNumber
  tokenBalanceA: BigNumber
  tokenBalanceB: BigNumber
  channelId: string
  partyA: string
  partyB: string
  partyI: string
  subchanAtoI: string
  subchanBtoI: string
  nonce: number
  onChainNonce: number
  updateTimeout: number
}
