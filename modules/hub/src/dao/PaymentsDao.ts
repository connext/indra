import DBEngine, { SQL } from '../DBEngine'
import {Client} from 'pg'
import log from '../util/log'

export default interface PaymentsDao {
  create(paymentId: number, disbursementId: number): Promise<number>
}

const LOG = log('PostgresPaymentsDao')

export class PostgresPaymentsDao implements PaymentsDao {
  private db: DBEngine<Client>

  constructor (db: DBEngine<Client>) {
    this.db = db
  }

  public async create(paymentId: number, disbursementId: number): Promise<number> {
    const { id } = await this.db.queryOne(SQL`
      INSERT INTO custodial_payments (
        payment_id,
        disbursement_id
      )
      VALUES (
        ${paymentId},
        ${disbursementId}
      ) RETURNING id
    `)

    return parseInt(id)
  }
}
