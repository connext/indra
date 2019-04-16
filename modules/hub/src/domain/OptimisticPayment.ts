import { Omit } from "../vendor/connext/types";
import { PurchasePaymentRow } from "./Purchase";


export type OptimisticPaymentStatus = "NEW" | "COMPLETED" | "FAILED"

export type OptimisticPurchasePaymentRow = Omit<PurchasePaymentRow, "type" | "id" | "custodianAddress"> & {
  status: OptimisticPaymentStatus
  channelUpdateId: number
  paymentId: number,
  threadUpdateId?: number
  redemptionId?: number
}