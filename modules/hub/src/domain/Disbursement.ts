import { BigNumber } from 'bignumber.js'

export enum DisbursementStatus {
  New = 'NEW',
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  Failed = 'FAILED',
}

export default interface Disbursement {
  id: number
  recipient: string
  amountWei: BigNumber
  amountErc20: BigNumber
  txHash: string
  status: DisbursementStatus
  createdAt: number
  confirmedAt: number | null
  failedAt: number | null
}
