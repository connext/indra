import { big, types } from 'connext';
import log from "../util/log";
import DBEngine, { SQL } from "../DBEngine";
import { Client } from 'pg'
const { Big } = big
type OptimisticPurchasePaymentRowBN = types.OptimisticPurchasePaymentRowBN

export default interface OptimisticPaymentDao {
  createOptimisticPayment(paymentId: number, channelUpdateId: number)
  getNewOptimisticPayments(): Promise<OptimisticPurchasePaymentRowBN[]>
  addOptimisticPaymentRedemption(paymentId: number, redemptionId: number): Promise<void>
  addOptimisticPaymentThread(paymentId: number, threadUpdateId: number): Promise<void>
  optimisticPaymentFailed(paymentId: number): Promise<void>
  getOptimisticPaymentById(paymentId: number): Promise<OptimisticPurchasePaymentRowBN>
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

  public async getOptimisticPaymentById(paymentId: number): Promise<OptimisticPurchasePaymentRowBN> {
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
          "payment_id",
          "status"
        FROM payments_optimistic where "payment_id" = ${paymentId}
      ) as up
      
      ON p.id = up.payment_id
    `)
    return this.rowToPaymentSummary(row)
  }

  public async getNewOptimisticPayments(): Promise<OptimisticPurchasePaymentRowBN[]> {
    const { rows } = await this.db.query(SQL`
      WITH po AS (
        SELECT 
          "channel_update_id",
          "thread_update_id",
          "redemption_id",
          "payment_id",
          "status"
        FROM payments_optimistic 
        WHERE "status" = 'NEW' 
      )
      SELECT * FROM po AS p
      INNER JOIN (
        SELECT * FROM payments WHERE "payment_type" = 'PT_OPTIMISTIC' 
      ) as d
      ON d.id = p.payment_id;
    `)
    return this.mapRows(rows)
  }

  public async addOptimisticPaymentRedemption(paymentId: number, redemptionId: number) {
    await this.db.queryOne(SQL`
      UPDATE payments_optimistic 
      SET 
        status = 'COMPLETED',
        redemption_id = ${redemptionId}
      WHERE payment_id = ${paymentId}
    `)
  }

  public async addOptimisticPaymentThread(paymentId: number, threadUpdateId: number) {
    await this.db.queryOne(SQL`
      UPDATE payments_optimistic 
      SET 
        status = 'COMPLETED',
        thread_update_id = ${threadUpdateId}
      WHERE payment_id = ${paymentId}
    `)
  }

  public async optimisticPaymentFailed(paymentId: number) {
    await this.db.query(SQL`
      UPDATE payments_optimistic 
      SET 
        status = 'FAILED'
      WHERE payment_id = ${paymentId}
    `)
  }

  private mapRows(rows: any): OptimisticPurchasePaymentRowBN[] {
    return rows.map(row => this.rowToPaymentSummary(row))
  }

  // expects there to be a channel_update_id field
  private rowToPaymentSummary(row): OptimisticPurchasePaymentRowBN | null {
    return row && {
      paymentId: Number(row.id),
      createdOn: row.created_on,
      purchaseId: row.purchase_id,
      sender: row.sender,
      recipient: row.recipient,
      amount: {
        amountWei: Big(row.amount_wei),
        amountToken: Big(row.amount_token),
      },
      meta: row.meta,
      channelUpdateId: Number(row.channel_update_id),
      status: row.status,
      threadUpdateId: row.thread_update_id ? Number(row.thread_update_id) : null,
      redemptionId: row.redemption_id ? Number(row.redemption_id) : null,
    }
  }
}
