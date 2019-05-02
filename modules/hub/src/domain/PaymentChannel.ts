import { BigNumber as BN } from 'ethers/utils'

export interface PaymentChannel {
  state: number
  spent: BN
  value: BN
  channelId: string
  receiver: string
  sender: string
}
