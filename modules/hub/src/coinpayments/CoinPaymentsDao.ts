import { Big } from '../util/bigNumber'
import { BigNumber } from 'bignumber.js/bignumber'
import { CoinPaymentsIpnData } from './CoinPaymentsService'
import { default as DBEngine, SQL } from '../DBEngine'
import { CPGetCallbackAddressResponse } from './CoinPaymentsApiClient'
import { ChannelStateUpdateBigNumber, DepositArgs } from '../vendor/connext/types'
import { ChannelStateUpdateRow } from '../domain/Channel'

export interface CoinPaymentsDepositAddress {
  address: string
  destTag?: string
}

export interface CoinPaymentsDepositAddressRow {
  id: number
  createdOn: Date
  user: string
  currency: string
  address: string
  destTag?: string
}

export interface CoinPaymentsIpnRow {
  id: number
  createdOn: Date
  user: string
  ipnId: string
  status: number
  statusText: string
  currency: string
  currencyFiat: string
  address: string
  amount: BigNumber
  amountFiat: BigNumber
  fee: BigNumber
  feeFiat: BigNumber
  data: CoinPaymentsIpnData
}

export interface CoinPaymentsUserCreditRow {
  id: number
  createdOn: Date
  ipnId: number
  user: string
  proposePendingId: number | null
}

export class CoinPaymentsDao {
  constructor(
    private db: DBEngine,
  ) {}

  async getUserDepositAddress(user: string, currency: string): Promise<CoinPaymentsDepositAddressRow | null> {
    return this.inflateDeposit(await this.db.queryOne(SQL`
      select *
      from coinpayments_deposit_addresses
      where
        "user" = ${user} and
        currency = ${currency}
      order by id desc
      limit 1
    `))
  }

  async saveUserDepositAddress(
    user: string,
    currency: string,
    addr: CPGetCallbackAddressResponse
  ): Promise<CoinPaymentsDepositAddressRow> {
    return this.inflateDeposit(await this.db.queryOne(SQL`
      insert into coinpayments_deposit_addresses (
        "user",
        currency,
        address,
        pubkey,
        dest_tag
      ) values (
        ${user},
        ${currency},
        ${addr.address},
        ${addr.pubkey},
        ${addr.dest_tag}
      )
      returning *
    `))
  }

  async saveIpn(user: string, ipn: CoinPaymentsIpnData): Promise<CoinPaymentsIpnRow> {
    return this.inflateIpn(await this.db.queryOne(SQL`
      insert into coinpayments_ipns (
        "user",
        ipn_id,
        status,
        status_text,
        currency,
        currency_fiat,
        address,
        amount,
        amount_fiat,
        fee,
        fee_fiat,
        data
      ) values (
        ${user},
        ${ipn.ipn_id},
        ${ipn.status},
        ${ipn.status_text},
        ${ipn.currency},
        ${ipn.fiat_coin},
        ${ipn.address},
        ${ipn.amount},
        ${ipn.fiat_amount},
        ${ipn.fee},
        ${ipn.fiat_fee},
        ${JSON.stringify(ipn)}::jsonb
      )
      returning *
    `))
  }

  async saveIpnLog(user: string, ipn: CoinPaymentsIpnData): Promise<void> {
    return await this.db.queryOne(SQL`
      insert into coinpayments_ipn_log (
        "user",
        ipn_id,
        status,
        status_text,
        address,
        data
      ) values (
        ${user},
        ${ipn.ipn_id},
        ${ipn.status},
        ${ipn.status_text},
        ${ipn.address},
        ${JSON.stringify(ipn)}::jsonb
      )
    `)
  }

  async getIpnByRowId(ipnRowId: number): Promise<CoinPaymentsIpnRow | null> {
    return this.inflateIpn(await this.db.queryOne(SQL`
      select *
      from coinpayments_ipns
      where id = ${ipnRowId}
    `))
  }

  async getIpnByIpnId(ipnId: string): Promise<CoinPaymentsIpnRow | null> {
    return this.inflateIpn(await this.db.queryOne(SQL`
      select *
      from coinpayments_ipns
      where ipn_id = ${ipnId}
      order by created_on desc
    `))
  }

  async createUserCredit(ipn: CoinPaymentsIpnRow): Promise<number> {
    const res = await this.db.queryOne(SQL`
      insert into _coinpayments_user_credits (ipn_id)
      values (${ipn.id})
      returning *
    `)

    return res.id
  }

  async getUserCreditForUpdate(id: number) {
    // acquire the FOR UPDATE lock
    await this.db.queryOne(SQL`
      SELECT *
      FROM _coinpayments_user_credits
      WHERE id = ${id}
      FOR UPDATE
    `)

    return this.inflateCreditRow(await this.db.queryOne(SQL`
      SELECT *
      FROM coinpayments_user_credits
      WHERE id = ${id}
    `))
  }

  async setUserCreditDepositUpdate(ipnId: string, update: ChannelStateUpdateRow<any>) {
    // Note: a trigger will check that:
    // - this credit hasn't already been used
    // - the update's user matches the IPN's user
    await this.db.queryOne(SQL`
      UPDATE _coinpayments_user_credits
      SET propose_pending_id = ${update.id}
      WHERE ipn_id = (
        SELECT ipn.id
        FROM coinpayments_ipns AS ipn
        WHERE ipn.ipn_id = ${ipnId}
      )
    `)
  }

  async getOutstandingCreditRowIds(): Promise<number[]> {
    return (await this.db.query(SQL`
      SELECT id
      FROM coinpayments_user_credits
      WHERE propose_pending_id IS NULL
    `)).rows.map(r => r.id)
  }

  private inflateDeposit(row: any): CoinPaymentsDepositAddressRow | null {
    return row && {
      ...row,
      createdOn: new Date(row.created_on),
      destTag: row.dest_tag,
    }
  }

  private inflateIpn(row: any): CoinPaymentsIpnRow | null {
    return row && {
      id: row.id,
      createdOn: new Date(row.created_on),
      user: row.user,
      ipnId: row.ipn_id,
      status: row.status,
      statusText: row.status_text,
      currency: row.currency,
      currencyFiat: row.currency_fiat,
      address: row.address,
      amount: Big(row.amount),
      amountFiat: Big(row.amount_fiat),
      fee: Big(row.fee),
      feeFiat: Big(row.fee_fiat),
      data: row.data,
    }
  }

  private inflateCreditRow(row: any): CoinPaymentsUserCreditRow | null {
    return row && {
      id: row.id,
      createdOn: new Date(row.created_on),
      ipnId: row.ipn_id,
      user: row.user,
      proposePendingId: row.propose_pending_id,
    }
  }
}
