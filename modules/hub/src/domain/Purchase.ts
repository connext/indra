import * as Connext from 'connext';

type PurchasePaymentSummary<T=any> = Connext.types.PurchasePaymentSummary<T>
type Payment = Connext.types.Payment

export type PurchaseRowWithPayments<MetaType=any, PaymentMetaType=any> = {
  purchaseId: string
  createdOn: Date
  sender: string
  meta: MetaType
  amount: Payment
  payments: PurchasePaymentRow<PaymentMetaType>[]
}

export type PurchasePaymentRow<MetaType=any> = PurchasePaymentSummary<MetaType> & {
  id: number
  createdOn: Date
  purchaseId: string
  sender: string
  custodianAddress: string
}
