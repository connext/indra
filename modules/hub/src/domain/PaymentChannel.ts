import { BN } from 'ethereumjs-util';

export interface PaymentChannel {
  state: number
  spent: BN
  value: BN
  channelId: string
  receiver: string
  sender: string
}
