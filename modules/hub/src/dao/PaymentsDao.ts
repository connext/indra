import DBEngine, { SQL } from '../DBEngine'
import {Client} from 'pg'
import log from '../util/log'

export default interface PaymentsDao {
  createChannelInstantPayment(paymentId: number, disbursementId: number, updateId: number): Promise<number>
  createHubPayment(paymentId: number, updateId: number): Promise<void>
  createThreadPayment(paymentId: number, updateId: number): Promise<void>
  createLinkPayment(paymentId: number, updateId: number, secret: string): Promise<void>
  addLinkedPaymentRedemption(paymentId: number, redemptionId: number): Promise<void>
}

const LOG = log('PostgresPaymentsDao')

export class PostgresPaymentsDao implements PaymentsDao {
  constructor(
    private db: DBEngine<Client>,
  ) {}

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
}
