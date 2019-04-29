import { BigNumber as BN } from 'ethers/utils'

export enum DisbursementStatus {
  New = 'NEW',
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  Failed = 'FAILED',
}

export default interface Disbursement {
  id: number
  recipient: string
  amountWei: BN
  amountErc20: BN
  txHash: string
  status: DisbursementStatus
  createdAt: number
  confirmedAt: number | null
  failedAt: number | null
}
