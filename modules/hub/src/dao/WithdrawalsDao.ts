import {Client, QueryResult} from 'pg'

import DBEngine from '../DBEngine'
import { TotalsTuple } from '../domain/TotalsTuple'
import Withdrawal, { WithdrawalStatus } from '../domain/Withdrawal'
import { BN, toBN } from '../util'

enum WithdrawalType {
  WEI,
  USD
}

export default interface WithdrawalsDao {
  createUsdWithdrawal(recipient: string): Promise<Withdrawal|null>

  createWeiWithdrawal(recipient: string): Promise<Withdrawal|null>

  createChannelDisbursement(initiator: string, recipient: string, amount: BN): Promise<Withdrawal|null>

  markPending(id: number, txhash: string): Promise<Withdrawal>

  markConfirmed(id: number): Promise<Withdrawal>

  markFailed(id: number): Promise<Withdrawal>

  totalFor(address: string, status: WithdrawalStatus): Promise<TotalsTuple>

  allFor(address: string): Promise<Withdrawal[]>

  byId(id: number): Promise<Withdrawal|null>
}

export class PostgresWithdrawalsDao implements WithdrawalsDao {
  private engine: DBEngine<Client>

  constructor (engine: DBEngine<Client>) {
    this.engine = engine
  }

  createUsdWithdrawal (recipient: string): Promise<Withdrawal|null> {
    throw new Error('This method has been removed as part of the non-custodial hub migration.')
  }

  createWeiWithdrawal (recipient: string): Promise<Withdrawal|null> {
    return this.createWithdrawal(recipient, WithdrawalType.WEI)
  }

  createChannelDisbursement(initiator: string, recipient: string, amount: BN): Promise<Withdrawal|null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT create_withdrawal_channel_disbursement($1, $2, $3) as id`,
        [
          initiator,
          recipient,
          amount.toString(),
        ]
      )

      return this.inflateLastId(c, res)
    })
  }

  markPending (id: number, txhash: string): Promise<Withdrawal> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'UPDATE withdrawals SET (status, txhash)=($1, $2) WHERE id = $3 RETURNING *',
        [
          WithdrawalStatus.PENDING.toString(),
          txhash,
          id
        ]
      )

      return this.inflateRow(res.rows[0])
    })
  }

  markConfirmed (id: number): Promise<Withdrawal> {
    return this.markState(id, WithdrawalStatus.CONFIRMED)
  }

  markFailed (id: number): Promise<Withdrawal> {
    return this.markState(id, WithdrawalStatus.FAILED)
  }

  totalFor (address: string, status: WithdrawalStatus): Promise<TotalsTuple> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT SUM(amountwei) as totalwei, SUM(amountusd) as totalusd FROM withdrawals WHERE recipient = $1 AND status = $2',
        [
          address,
          status.toString()
        ]
      )

      const row = res.rows[0]

      if (!row.totalwei || !row.totalusd) {
        return {
          totalWei: toBN(0),
          totalUsd: toBN(0)
        }
      }

      return {
        totalWei: toBN(row.totalwei),
        totalUsd: toBN(row.totalusd)
      }
    })
  }

  allFor (address: string): Promise<Withdrawal[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM withdrawals WHERE recipient = $1',
        [
          address
        ]
      )

      return res.rows.map((r: QueryResult) => this.inflateRow(r))
    })
  }

  byId (id: number): Promise<Withdrawal | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM withdrawals WHERE id = $1',
        [
          id
        ]
      )

      if (!res.rows.length) {
        return null
      }

      return this.inflateRow(res.rows[0])
    })
  }

  private markState(id: number, status: WithdrawalStatus) {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'UPDATE withdrawals SET status = $1 WHERE id = $2 RETURNING *',
        [
          status.toString(),
          id
        ]
      )

      return this.inflateRow(res.rows[0])
    })
  }

  private async inflateLastId(c: Client, res: QueryResult) {
    const id = res.rows[0].id

    if (id === '-1') {
      return null
    }

    res = await c.query(
      'SELECT * from withdrawals WHERE id = $1',
      [
        id
      ]
    )

    return this.inflateRow(res.rows[0])
  }

  private createWithdrawal(recipient: string, type: WithdrawalType): Promise<Withdrawal|null> {
    return this.engine.exec(async (c: Client) => {
      const func = type === WithdrawalType.USD ? 'create_withdrawal_usd_amount' : 'create_withdrawal_wei_amount'

      let res = await c.query(
        `SELECT ${func}($1) as id`,
        [
          recipient
        ]
      )

      const id = res.rows[0].id

      if (id === '-1') {
        return null
      }

      res = await c.query(
        'SELECT * from withdrawals WHERE id = $1',
        [
          id
        ]
      )

      return this.inflateRow(res.rows[0])
    })
  }

  private inflateRow(row: any): Withdrawal {
    return {
      id: Number(row.id),
      recipient: row.recipient,
      initiator: row.initiator,
      amountWei: toBN(row.amountwei),
      amountUsd: toBN(row.amountusd),
      txhash: row.txhash,
      status: row.status,
      createdAt: Number(row.createdat),
      pendingAt: row.pendingat ? Number(row.pendingat) : null,
      confirmedAt: row.confirmedat ? Number(row.confirmedat) : null,
      failedAt: row.failedat ? row.failedat : null
    } as Withdrawal
  }
}
