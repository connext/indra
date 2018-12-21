import { PurchasePaymentSummary, Payment } from "../vendor/connext/types";

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
