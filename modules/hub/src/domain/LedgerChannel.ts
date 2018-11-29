import { BigNumber } from 'bignumber.js'
import { LcStatus } from '../dao/ChainsawLcDao'
import { UpdateReason } from '../dao/LedgerChannelsDao'

export interface LcStateUpdateDto {
  id?: number
  channelId?: string
  isClose: boolean
  nonce: number
  openVcs: number
  vcRootHash: string
  ethBalanceA: BigNumber
  ethBalanceI: BigNumber
  tokenBalanceA: BigNumber
  tokenBalanceI: BigNumber
  reason: UpdateReason
  priceWei?: BigNumber
  priceToken?: BigNumber
  vcId?: string
  sigA?: string
  sigI?: string
}

// Note: this has been coppied to vynos/lib/connext/ConnextTypes.ts
export interface LcStateUpdate {
  id: number
  channelId: string
  isClose: boolean
  nonce: number
  openVcs: number
  vcRootHash: string
  ethBalanceA: BigNumber
  ethBalanceI: BigNumber
  tokenBalanceA: BigNumber
  tokenBalanceI: BigNumber
  priceWei: BigNumber
  priceToken: BigNumber
  sigA?: string
  sigI?: string
  reason: UpdateReason
}

export interface LedgerChannelDto {
  state: LcStatus
  channelId: string
  partyA: string
  partyI: string
}

// Note: this is coppied in vynos/lib/connext/ConnextTypes.ts
export interface LedgerChannel {
  state: LcStatus
  ethBalanceA: BigNumber
  ethBalanceI: BigNumber
  tokenBalanceA: BigNumber
  tokenBalanceI: BigNumber
  channelId: string
  partyA: string
  partyI: string
  token: string
  nonce: number
  openVcs: number
  vcRootHash: string
  openTimeout: number
  updateTimeout: number
}

export interface ChainsawLedgerChannel extends LedgerChannel {
  contract: string
}

export interface ChainsawDeposit {
  depositId: number
  deposit: BigNumber
  isToken: boolean
  recipient: string
  updateId: number | null
}
