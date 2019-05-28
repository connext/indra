import { PurchasePaymentRow, PurchasePaymentSummary } from 'connext/types'

import Config from '../Config'
import DBEngine, {SQL} from '../DBEngine'

export interface PaymentMetaDao {
  save (purchaseId: string, payment: PurchasePaymentSummary): Promise<number>
  historyByUser (address: string): Promise<PurchasePaymentRow[]>
  byPurchase (id: string): Promise<PurchasePaymentRow[]>
  getLinkedPayment(secret: string): Promise<PurchasePaymentRow> 
  redeemLinkedPayment(user: string, secret: string): Promise<void> 
}

export class PostgresPaymentMetaDao implements PaymentMetaDao {
  private db: DBEngine
  private config: Config

  constructor (db: DBEngine, config: Config) {
    this.db = db
    this.config = config
  }

  public async save (purchaseId: string, payment: PurchasePaymentSummary): Promise<number> {
    // Note: this only returns the ID because returning a full
    // `PurchasePaymentRow` would require a second query to hit the `payments`
    // view, and at the moment none of the callers of this function need the
    // whole row.
    const { id } = await this.db.queryOne(SQL`
      INSERT INTO _payments (
        purchase_id, recipient,
        amount_wei, amount_token,
        meta
      )
      VALUES (
        ${purchaseId}, ${payment.recipient},
        ${payment.amount.amountWei}, ${payment.amount.amountToken},
        ${JSON.stringify(payment.meta)}::jsonb
      ) RETURNING id
    `)
    return parseInt(id)
  }

  public async historyByUser (address: string): Promise<PurchasePaymentRow[]> {
    const res = await this.db.query(SQL`
      SELECT * from payments
      WHERE
      (recipient = ${address}
      OR sender = ${address})
      AND recipient != ${this.config.hotWalletAddress}
      ORDER BY created_on DESC
    `)

    return res.rows.map((row: any) => this.rowToPaymentSummary(row))
  }

  public async getLinkedPayment(secret: string): Promise<PurchasePaymentRow> {
    const row = await this.db.queryOne(SQL`
      SELECT * from payments
      WHERE id = (
        SELECT payment_id FROM payments_link
        WHERE "secret" = ${secret}
      )
      LIMIT 1
    `)
    return this.rowToPaymentSummary(row)
  }

  public async redeemLinkedPayment(user: string, secret: string): Promise<void> {
    await this.db.queryOne(SQL`
      UPDATE _payments
      SET "recipient" = ${user.toLowerCase()}
      WHERE _payments.id = (
        SELECT payment_id FROM payments_link
        WHERE "secret" = ${secret}
      )
    `)
  }

  /*
  public bySender(address: string): Promise<PaymentMeta[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(`SELECT * FROM payments WHERE sender = $1`, [
        address,
      ])

      return this.mapRows(res.rows)
    })
  }

  public byReceiver(
    address: string,
    type: PurchaseMetaType,
  ): Promise<PaymentMeta[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM payments WHERE receiver = $1 AND type = $2`,
        [address, type.toString()],
      )

      return this.mapRows(res.rows)
    })
  }

  public allAffectingAddress(address: string): Promise<PaymentMeta[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM payments WHERE (receiver = $1 OR sender = $1) AND type != 'EXCHANGE' ORDER BY created_at DESC`,
        [address],
      )

      return this.mapRows(res.rows)
    })
  }

  public all(): Promise<PaymentMeta[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(`SELECT * FROM payments`)

      return this.mapRows(res.rows)
    })
  }

  public allByType(type: PurchaseMetaType): Promise<PaymentMeta[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM payments WHERE type = $1 ORDER BY created_at DESC`,
        [type.toString()],
      )

      return this.mapRows(res.rows)
    })
  }

  public byToken(token: string): Promise<PaymentMeta> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(`SELECT * from payments WHERE token = $1`, [
        token,
      ])

      return this.mapRows(res.rows)[0]
    })
  }

  */

  public async byPurchase(id: string): Promise<PurchasePaymentRow[]> {
    return this.mapRows((await this.db.query(SQL`
      SELECT *
      FROM payments
      WHERE purchase_id = ${id}
    `)).rows)
  }

  private mapRows(rows: any[]): PurchasePaymentRow[] {
    return rows.map(row => this.rowToPaymentSummary(row))
  }

  private rowToPaymentSummary(row: any): PurchasePaymentRow | null {
    return row && {
      id: Number(row.id),
      createdOn: row.created_on,
      purchaseId: row.purchase_id,
      sender: row.sender,
      recipient: row.recipient,
      amount: {
        amountWei: row.amount_wei,
        amountToken: row.amount_token,
      },
      meta: row.meta,
      type: row.payment_type,
      custodianAddress: row.custodian_address,
    }
  }
}
