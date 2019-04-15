import log from "../util/log";
import DBEngine, { SQL } from "../DBEngine";
import { Client } from 'pg'
import { OptimisticPurchasePaymentRow } from "../domain/OptimisticPayment";

export default interface OptimisticPaymentDao {
  createOptimisticPayment(paymentId: number, channelUpdateId: number)
  getNewOptimisticPayments(): Promise<OptimisticPurchasePaymentRow[]>
  addOptimisticPaymentRedemption(paymentId: number, redemptionId: number): Promise<void>
  addOptimisticPaymentThread(paymentId: number, threadUpdateId: number): Promise<void>
  addOptimisticPaymentCustodial(paymentId: number, custodialId: number): Promise<void>
  optimisticPaymentFailed(paymentId: number): Promise<void>
  getOptimisticPaymentById(paymentId: number): Promise<OptimisticPurchasePaymentRow>
}

const LOG = log('PostgresOptimisticPaymentDao')

export class PostgresOptimisticPaymentDao implements OptimisticPaymentDao {
  constructor(
    private db: DBEngine<Client>,
  ) {}

  public async createOptimisticPayment(paymentId: number, updateId: number): Promise<void> {
    await this.db.queryOne(SQL`
      INSERT INTO payments_optimistic (
        payment_id,
        channel_update_id
      )
      VALUES (
        ${paymentId},
        ${updateId}
      )
    `)
  }

  public async getOptimisticPaymentById(paymentId: number): Promise<OptimisticPurchasePaymentRow> {
    const row = await this.db.queryOne(SQL`
      SELECT * FROM (
        SELECT * 
        FROM payments
        WHERE id = ${paymentId}
      ) as p
      
      INNER JOIN (
        SELECT 
          "channel_update_id",
          "thread_update_id",
          "redemption_id",
          "custodial_id",
          "payment_id",
          "status"
        FROM payments_optimistic where "payment_id" = ${paymentId}
      ) as up
      
      ON p.id = up.payment_id
    `)
    return this.rowToPaymentSummary(row)
  }

  public async getNewOptimisticPayments(): Promise<OptimisticPurchasePaymentRow[]> {
    const { rows } = await this.db.query(SQL`
      SELECT * FROM (
        SELECT * 
        FROM payments
        WHERE id = (
          SELECT "payment_id" FROM payments_optimistic WHERE "status" = 'new'
        )
      ) as p
      
      INNER JOIN (
        SELECT 
          "channel_update_id",
          "thread_update_id",
          "redemption_id",
          "custodial_id",
          "payment_id",
          "status"
        FROM payments_optimistic where "status" = 'new'
      ) as up
      
      ON p.id = up.payment_id
    `)
    return this.mapRows(rows)
  }

  public async addOptimisticPaymentRedemption(paymentId: number, redemptionId: number) {
    await this.db.queryOne(SQL`
      UPDATE payments_optimistic 
      SET 
        status = 'completed',
        redemption_id = ${redemptionId}
      WHERE payment_id = ${paymentId}
    `)
  }

  public async addOptimisticPaymentThread(paymentId: number, threadUpdateId: number) {
    await this.db.queryOne(SQL`
      UPDATE payments_optimistic 
      SET 
        status = 'completed',
        thread_update_id = ${threadUpdateId}
      WHERE payment_id = ${paymentId}
    `)
  }

  public async addOptimisticPaymentCustodial(paymentId: number, custodialId: number) {
    await this.db.queryOne(SQL`
      UPDATE payments_optimistic 
      SET 
        status = 'custodial',
        custodial_id = ${custodialId}
      WHERE payment_id = ${paymentId}
    `)
  }

  public async optimisticPaymentFailed(paymentId: number) {
    await this.db.query(SQL`
      UPDATE payments_optimistic 
      SET 
        status = 'failed'
      WHERE payment_id = ${paymentId}
    `)
  }

  private mapRows(rows: any): OptimisticPurchasePaymentRow[] {
    return rows.map(row => this.rowToPaymentSummary(row))
  }

  // expects there to be a channel_update_id field
  private rowToPaymentSummary(row): OptimisticPurchasePaymentRow | null {
    return row && {
      paymentId: Number(row.id),
      createdOn: row.created_on,
      purchaseId: row.purchase_id,
      sender: row.sender,
      recipient: row.recipient,
      amount: {
        amountWei: row.amount_wei,
        amountToken: row.amount_token,
      },
      meta: row.meta,
      custodianAddress: row.custodian_address,
      channelUpdateId: Number(row.channel_update_id),
      status: row.status,
      threadUpdateId: row.thread_update_id ? Number(row.thread_update_id) : null,
      redemptionId: row.redemption_id ? Number(row.redemption_id) : null,
      custodialId: row.custodial_id ? Number(row.custodial_id) : null,
    }
  }
}