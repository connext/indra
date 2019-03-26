import { BigNumber } from 'bignumber.js/bignumber'
import { default as DBEngine, SQL } from '../DBEngine'
import { Big } from '../util/bigNumber'

export interface CustodialBalanceRow {
  user: string
  totalReceivedWei: BigNumber
  totalReceivedToken: BigNumber
  totalWithdrawnWei: BigNumber
  totalWithdrawnToken: BigNumber
  balanceWei: BigNumber
  balanceToken: BigNumber
  sentWei: BigNumber
}

export interface CreateCustodialWithdrawalOptions {
  user: string
  recipient: string
  requestedToken: BigNumber
  exchangeRate: BigNumber
  sentWei: BigNumber
  onchainTransactionId: number
}

export interface CustodialWithdrawalRow {
  id: number
  createdOn: Date
  user: string
  recipient: string
  requestedToken: BigNumber
  exchangeRate: BigNumber
  sentWei: BigNumber
  state: string
  txHash: string
  onchainTransactionId: number
}

export class CustodialPaymentsDao {
  constructor(
    private db: DBEngine,
  ) {}

  async getCustodialBalance(user: string): Promise<CustodialBalanceRow> {
    return this.inflateCustodialBalance(user, await this.db.queryOne(SQL`
      select *
      from custodial_balances
      where "user" = ${user}
    `))
  }

  async createCustodialPayment(paymentId: number, updateId: number): Promise<CustodialWithdrawalRow> {
    return this.inflateCustodialWithdrawalRow(await this.db.queryOne(SQL`
      insert into payments_channel_custodial (payment_id, update_id)
      values (${paymentId}, ${updateId})
      returning *
    `))
  }

  async createCustodialWithdrawal(opts: CreateCustodialWithdrawalOptions): Promise<CustodialWithdrawalRow> {
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
        ${opts.requestedToken.toFixed()},
        ${opts.exchangeRate.toFixed()},
        ${opts.sentWei.toFixed()},
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

  async getCustodialWithdrawals(user: string): Promise<CustodialWithdrawalRow[]> {
    return (await this.db.query(SQL`
      select *
      from custodial_withdrawals
      where "user" = ${user}
      order by id asc
    `)).rows.map(row => this.inflateCustodialWithdrawalRow(row))
  }

  async getCustodialWithdrawal(user: string, id: number): Promise<CustodialWithdrawalRow> {
    return this.inflateCustodialWithdrawalRow(await this.db.queryOne(SQL`
      select *
      from custodial_withdrawals
      where
        "user" = ${user} and
        id = ${id}
    `))
  }

  private inflateCustodialBalance(user: string, row: any): CustodialBalanceRow {
    row = row || { user }
    return {
      user: row.user,
      totalReceivedWei: Big(row.total_received_wei || '0'),
      totalReceivedToken: Big(row.total_received_token || '0'),
      totalWithdrawnWei: Big(row.total_withdrawn_wei || '0'),
      totalWithdrawnToken: Big(row.total_withdrawn_token || '0'),
      balanceWei: Big(row.balance_wei || '0'),
      balanceToken: Big(row.balance_token || '0'),
      sentWei: Big(row.sent_wei || '0'),
    }
  }

  private inflateCustodialWithdrawalRow(row: any): CustodialWithdrawalRow {
    return row && {
      id: row.id,
      createdOn: row.created_on,
      user: row.user,
      recipient: row.recipient,
      requestedToken: Big(row.requested_token),
      exchangeRate: Big(row.exchange_rate),
      sentWei: Big(row.sent_wei),
      state: row.state,
      txHash: row.tx_hash,
      onchainTransactionId: row.onchain_tx_id,
    }
  }
}
