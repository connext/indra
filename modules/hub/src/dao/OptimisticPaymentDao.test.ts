import OptimisticPaymentDao from "./OptimisticPaymentDao";
import { PaymentMetaDao } from "./PaymentMetaDao";
import { tokenVal, channelUpdateFactory } from "../testing/factories";
import { getTestRegistry, assert } from "../testing";
import { mkAddress } from "../testing/stateUtils";

describe("OptimisticPaymentDao", () => {
  const registry = getTestRegistry()
  const optimisticDao: OptimisticPaymentDao = registry.get('PaymentsDao')
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })
})