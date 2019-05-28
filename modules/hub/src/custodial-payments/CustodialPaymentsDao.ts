import {
  CreateCustodialWithdrawalOptionsBN,
  CustodialBalanceRowBN,
  CustodialPaymentsRow,
  CustodialWithdrawalRowBN,
} from 'connext/types'

import { default as DBEngine, SQL } from '../DBEngine'
import { toBN } from '../util'

export class CustodialPaymentsDao {
  constructor(
    private db: DBEngine,
  ) {}

  async getCustodialBalance(user: string): Promise<CustodialBalanceRowBN> {
    return this.inflateCustodialBalance(user, await this.db.queryOne(SQL`
      select *
      from custodial_balances
      where "user" = ${user}
    `))
  }

  async createCustodialPayment(paymentId: number, updateId: number): Promise<CustodialPaymentsRow> {
    const row = await this.db.queryOne(SQL`
      insert into payments_channel_custodial (payment_id, update_id)
      values (${paymentId}, ${updateId})
      returning *
    `)
    return {
      paymentId: row.payment_id,
      updateId: row.update_id,
    }
  }

  async createCustodialWithdrawal(opts: CreateCustodialWithdrawalOptionsBN): Promise<CustodialWithdrawalRowBN> {
    const { id } = await this.db.queryOne(SQL`
      insert into _custodial_withdrawals (
        "user",
        recipient,
        requested_token,
        exchange_rate,
        sent_wei,
        onchain_tx_id
      ) values (
        ${opts.user},
        ${opts.recipient},
        ${opts.requestedToken.toString()},
        ${opts.exchangeRate},
        ${opts.sentWei.toString()},
        ${opts.onchainTransactionId}
      )
      returning id
    `)
    return this.inflateCustodialWithdrawalRow(await this.db.queryOne(SQL`
      select *
      from custodial_withdrawals
      where id = ${id}
    `))
  }

  async getCustodialWithdrawals(user: string): Promise<CustodialWithdrawalRowBN[]> {
    return (await this.db.query(SQL`
      select *
      from custodial_withdrawals
      where "user" = ${user}
      order by id asc
    `)).rows.map(row => this.inflateCustodialWithdrawalRow(row))
  }

  async getCustodialWithdrawal(user: string, id: number): Promise<CustodialWithdrawalRowBN> {
    return this.inflateCustodialWithdrawalRow(await this.db.queryOne(SQL`
      select *
      from custodial_withdrawals
      where
        "user" = ${user} and
        id = ${id}
    `))
  }

  private inflateCustodialBalance(user: string, row: any): CustodialBalanceRowBN {
    row = row || { user }
    return {
      user: row.user,
      totalReceivedWei: toBN(row.total_received_wei || '0'),
      totalReceivedToken: toBN(row.total_received_token || '0'),
      totalWithdrawnWei: toBN(row.total_withdrawn_wei || '0'),
      totalWithdrawnToken: toBN(row.total_withdrawn_token || '0'),
      balanceWei: toBN(row.balance_wei || '0'),
      balanceToken: toBN(row.balance_token || '0'),
      sentWei: toBN(row.sent_wei || '0'),
    }
  }

  private inflateCustodialWithdrawalRow(row: any): CustodialWithdrawalRowBN {
    return row && {
      id: row.id,
      createdOn: row.created_on,
      user: row.user,
      recipient: row.recipient,
      requestedToken: toBN(row.requested_token),
      exchangeRate: row.exchange_rate,
      sentWei: toBN(row.sent_wei),
      state: row.state,
      txHash: row.tx_hash,
      onchainTransactionId: row.onchain_tx_id,
    }
  }
}
