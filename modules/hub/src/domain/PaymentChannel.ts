import { BigNumber } from 'bignumber.js';

export interface PaymentChannel {
  state: number
  spent: BigNumber
  value: BigNumber
  channelId: string
  receiver: string
  sender: string
}
