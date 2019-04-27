import { BigNumber } from 'ethers/utils'
import { big } from '../Connext'
import { default as DBEngine, SQL } from '../DBEngine'

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
  exchangeRate: string
  sentWei: BigNumber
  onchainTransactionId: number
}

export interface CustodialWithdrawalRow {
  id: number
  createdOn: Date
  user: string
  recipient: string
  requestedToken: BigNumber
  exchangeRate: string
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
        ${opts.requestedToken.toString()},
        ${opts.exchangeRate.toString()},
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
      totalReceivedWei: big.Big(row.total_received_wei || '0'),
      totalReceivedToken: big.Big(row.total_received_token || '0'),
      totalWithdrawnWei: big.Big(row.total_withdrawn_wei || '0'),
      totalWithdrawnToken: big.Big(row.total_withdrawn_token || '0'),
      balanceWei: big.Big(row.balance_wei || '0'),
      balanceToken: big.Big(row.balance_token || '0'),
      sentWei: big.Big(row.sent_wei || '0'),
    }
  }

  private inflateCustodialWithdrawalRow(row: any): CustodialWithdrawalRow {
    return row && {
      id: row.id,
      createdOn: row.created_on,
      user: row.user,
      recipient: row.recipient,
      requestedToken: big.Big(row.requested_token),
      exchangeRate: row.exchange_rate,
      sentWei: big.Big(row.sent_wei),
      state: row.state,
      txHash: row.tx_hash,
      onchainTransactionId: row.onchain_tx_id,
    }
  }
}
