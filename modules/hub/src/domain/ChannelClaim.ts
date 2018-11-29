export enum ChannelClaimStatus {
  NEW = 'NEW',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export interface ChannelClaim {
  channelId: string
  status: ChannelClaimStatus
  createdAt: number
  pendingAt: number | null
  confirmedAt: number | null
  failedAt: number | null
}

export default function channelClaimToJson(c: ChannelClaim) {
  return {
    channelId: c.channelId,
    status: c.status.toString(),
    createdAt: c.createdAt,
    pendingAt: c.pendingAt,
    confirmedAt: c.confirmedAt,
    failedAt: c.failedAt,
  }
}
