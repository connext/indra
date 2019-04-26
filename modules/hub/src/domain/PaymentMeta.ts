export interface WithdrawalDto {
  recipient: string
}

/*

export enum PurchaseMetaType {
  PURCHASE = 'PURCHASE',
  TIP = 'TIP',
  EXCHANGE = 'EXCHANGE',
  WITHDRAWAL = 'WITHDRAWAL'
}

export interface PurchaseDto {
  type: 'PURCHASE'
  productSku: string
  productName: string
}
export interface PaymentMetaDto {
  receiver: string
  type: 'PURCHASE' | 'TIP' | 'WITHDRAWAL' | 'FEE' | 'UNCATEGORIZED' | 'EXCHANGE'
  fields: PurchaseDto | TipDto | WithdrawalDto
}

export interface PaymentMeta {
  receiver: string
  sender: string
  type: PurchaseMetaType
  fields: PurchaseDto | TipDto
  payment: Payment
  amountWei: number
  amountToken: number
  createdAt: number
}

export interface Payment {
  channelId: string
  meta: string
  token: number
  purchase: string
}

export interface Payments {
  type: PaymentType
  payment: PaymentDto
  meta: PaymentMeta
}

export interface PaymentInfo {
  id: number
  sender: string
  receiver: string
  priceWei?: BigNumber
  priceToken?: BigNumber
}
*/
