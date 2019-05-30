import DBEngine, { SQL } from '../DBEngine'
import {Client} from 'pg'

// TODO: delete this type
export interface EmailRow {
  id: number,
  mailgunId: string,
  user: string,
  subject: string,
  body: string,
}

export default interface PaymentsDao {
  createChannelInstantPayment(paymentId: number, disbursementId: number, updateId: number): Promise<number>
  createHubPayment(paymentId: number, updateId: number): Promise<void>
  createThreadPayment(paymentId: number, updateId: number): Promise<void>
  createLinkPayment(paymentId: number, updateId: number, secret: string): Promise<void>
  addLinkedPaymentRedemption(paymentId: number, redemptionId: number): Promise<void>
  // TODO: delete
  getEmailsByUser(user: string): Promise<null | EmailRow[]>
  // TODO: delete
  createEmail(mailgunId: string, user: string, subject: string, body: string): Promise<EmailRow>
}

export class PostgresPaymentsDao implements PaymentsDao {
  constructor(
    private db: DBEngine<Client>,
  ) {}

  // TODO: delete
  public async getEmailsByUser(user: string): Promise<null | EmailRow[]> {
    const { rows } = await this.db.query(SQL`
        SELECT * 
        FROM emails
        WHERE "address" = ${user}
      ;
    `)
    return rows ? rows.map(row => this.inflateEmailRow(row)) : null
  }

  // TODO: delete
  public async createEmail(mailgunId: string, user: string, subject: string, body: string): Promise<EmailRow> {
    const row = this.inflateEmailRow(
      await this.db.queryOne(SQL`
        INSERT INTO emails (
          mailgun_id,
          address,
          subject,
          body
        )
        VALUES (
          ${mailgunId},
          ${user},
          ${subject},
          ${body}
        )
        returning *;
      `)
    )
    return row
  }

  public async createChannelInstantPayment(paymentId: number, disbursementId: number, updateId: number): Promise<number> {
    const { id } = await this.db.queryOne(SQL`
      INSERT INTO payments_channel_instant (
        payment_id,
        disbursement_id,
        update_id
      )
      VALUES (
        ${paymentId},
        ${disbursementId},
        ${updateId}
      )
      returning id
    `)
    return id
  }

  public async createHubPayment(paymentId: number, updateId: number): Promise<void> {
    await this.db.queryOne(SQL`
      INSERT INTO payments_hub_direct (
        payment_id,
        update_id
      )
      VALUES (
        ${paymentId},
        ${updateId}
      )
    `)
  }

  public async createThreadPayment(paymentId: number, updateId: number): Promise<void> {
    await this.db.queryOne(SQL`
      INSERT INTO payments_thread (
        payment_id,
        update_id
      )
      VALUES (
        ${paymentId},
        ${updateId}
      )
    `)
  }

  public async createLinkPayment(paymentId: number, updateId: number, secret: string): Promise<void> {
    await this.db.queryOne(SQL`
      INSERT INTO payments_link (
        payment_id,
        update_id,
        "secret"
      )
      VALUES (
        ${paymentId},
        ${updateId},
        ${secret}
      )
    `)
  }

  public async addLinkedPaymentRedemption(paymentId: number, redemptionId: number): Promise<void> {
    await this.db.queryOne(SQL`
      UPDATE payments_link SET redemption_id = ${redemptionId} WHERE payment_id = ${paymentId}
    `)
  }

  // TODO: delete
  private inflateEmailRow(row: any): EmailRow {
    return row && {
      id: Number(row.id),
      user: row.address,
      mailgunId: row.mailgun_id,
      subject: row.subject,
      body: row.body
    }
  }
}
