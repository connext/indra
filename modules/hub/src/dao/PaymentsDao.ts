import DBEngine, { SQL } from '../DBEngine'
import {Client} from 'pg'
import log from '../util/log'

export default interface PaymentsDao {
  createChannelInstantPayment(paymentId: number, disbursementId: number, updateId: number): Promise<void>
  createHubPayment(paymentId: number, updateId: number): Promise<void>
}

const LOG = log('PostgresPaymentsDao')

export class PostgresPaymentsDao implements PaymentsDao {
  constructor(
    private db: DBEngine<Client>,
  ) {}

  public async createChannelInstantPayment(paymentId: number, disbursementId: number, updateId: number): Promise<void> {
    await this.db.queryOne(SQL`
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
    `)
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
}
