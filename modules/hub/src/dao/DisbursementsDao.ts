import { Client } from 'pg'

import DBEngine from '../DBEngine'
import Disbursement, { DisbursementStatus } from '../domain/Disbursement'
import { PostgresGenericDao } from './GenericDao'
import { BN, toBN } from '../util'

export default interface DisbursementDao {
  create(recipient: string, amountWei: BN): Promise<Disbursement>
  createErc20(recipient: string, amountErc20: BN): Promise<Disbursement>
  markFailed(id: Number): Promise<Disbursement>
  markPending(id: Number, txHash: string): Promise<Disbursement>
  markConfirmed(id: Number): Promise<Disbursement>
  getCurrentByAddress(address: string): Promise<Disbursement | null>
  getCurrentByAddressErc20(address: string): Promise<Disbursement | null>
  getByAddressAndId(address: string, id: number): Promise<Disbursement | null>
}

export class PostgresDisbursementDao extends PostgresGenericDao
  implements DisbursementDao {
  constructor(engine: DBEngine<Client>) {
    super(engine)
  }

  public create(
    recipient: string,
    amountWei: BN,
  ): Promise<Disbursement> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `INSERT INTO disbursements(recipient, amountwei, status) VALUES ($1, $2, $3) RETURNING *`,
        [recipient, amountWei.toString(), DisbursementStatus.New],
      )

      const row = res.rows[0]
      return this.inflateRow(row)
    })
  }

  public createErc20(
    recipient: string,
    amountErc20: BN,
  ): Promise<Disbursement> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `INSERT INTO disbursements(recipient, amounterc20, status) VALUES ($1, $2, $3) RETURNING *`,
        [recipient, amountErc20.toString(), DisbursementStatus.New],
      )

      const row = res.rows[0]
      return this.inflateRow(row)
    })
  }

  public markPending(id: Number, txHash: string): Promise<Disbursement> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `UPDATE disbursements SET (status, txhash) = ($1, $2) WHERE id = $3 RETURNING *`,
        [DisbursementStatus.Pending, txHash, id],
      )

      const row = res.rows[0]
      return this.inflateRow(row)
    })
  }

  public markFailed(id: Number): Promise<Disbursement> {
    return this.markStatus(id, DisbursementStatus.Failed)
  }

  public markConfirmed(id: Number): Promise<Disbursement> {
    return this.markStatus(id, DisbursementStatus.Confirmed)
  }

  public getCurrentByAddress(address: string): Promise<Disbursement | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT *
          FROM disbursements
          WHERE recipient = $1
            AND status != $2
            AND amountwei IS NOT NULL
            AND amounterc20 IS NULL
          LIMIT 1`,
        [address, DisbursementStatus.Failed],
      )

      if (!res.rows.length) {
        return null
      }

      const [row] = res.rows
      return this.inflateRow(row)
    })
  }

  public getCurrentByAddressErc20(address: string): Promise<Disbursement | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT *
          FROM disbursements
          WHERE recipient = $1
            AND status != $2
            AND amounterc20 IS NOT NULL
            AND amountwei IS NULL
          LIMIT 1`,
        [address, DisbursementStatus.Failed],
      )

      if (!res.rows.length) {
        return null
      }

      const [row] = res.rows
      return this.inflateRow(row)
    })
  }

  public getByAddressAndId(address: string, id: number): Promise<Disbursement | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM disbursements WHERE recipient = $1 AND id = $2 LIMIT 1`,
        [address, id],
      )

      if (!res.rows.length) {
        return null
      }

      const [row] = res.rows
      return this.inflateRow(row)
    })
  }

  private markStatus(
    id: Number,
    status: DisbursementStatus,
  ): Promise<Disbursement> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `UPDATE disbursements SET status = $1 WHERE id = $2 RETURNING *`,
        [status, id],
      )

      const row = res.rows[0]
      return this.inflateRow(row)
    })
  }

  private inflateRow(row: any): Disbursement {
    return {
      amountWei: row.amountwei && toBN(row.amountwei),
      amountErc20: row.amounterc20 && toBN(row.amounterc20),
      confirmedAt: Number(row.confirmedat),
      createdAt: Number(row.createdat),
      failedAt: Number(row.failedat),
      id: Number(row.id),
      recipient: row.recipient,
      status: row.status,
      txHash: row.txhash,
    }
  }
}
