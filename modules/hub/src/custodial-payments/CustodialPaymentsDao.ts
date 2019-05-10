import { big, types } from 'connext'
import { default as DBEngine, SQL } from '../DBEngine'

type CustodialBalanceRowBN = types.CustodialBalanceRowBN
type CustodialPaymentsRow = types.CustodialPaymentsRow
type CreateCustodialWithdrawalOptionsBN = types.CreateCustodialWithdrawalOptionsBN
type CustodialWithdrawalRowBN = types.CustodialWithdrawalRowBN

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
      totalReceivedWei: big.Big(row.total_received_wei || '0'),
      totalReceivedToken: big.Big(row.total_received_token || '0'),
      totalWithdrawnWei: big.Big(row.total_withdrawn_wei || '0'),
      totalWithdrawnToken: big.Big(row.total_withdrawn_token || '0'),
      balanceWei: big.Big(row.balance_wei || '0'),
      balanceToken: big.Big(row.balance_token || '0'),
      sentWei: big.Big(row.sent_wei || '0'),
    }
  }

  private inflateCustodialWithdrawalRow(row: any): CustodialWithdrawalRowBN {
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
