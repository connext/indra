import { Omit } from "../vendor/connext/types";
import { PurchasePaymentRow } from "./Purchase";


export type OptimisticPaymentStatus = "new" | "custodial" | "completed" | "failed"

export type OptimisticPurchasePaymentRow = Omit<PurchasePaymentRow, "id"> & {
  status: OptimisticPaymentStatus
  channelUpdateId: number
  paymentId: number
}