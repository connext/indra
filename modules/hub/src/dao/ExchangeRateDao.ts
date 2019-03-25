import DBEngine, { SQL } from '../DBEngine'
import { Client } from 'pg'
import ExchangeRate from '../domain/ExchangeRate'
import CurrencyCode from '../domain/CurrencyCode'
import { Big } from '../util/bigNumber'
import { BigNumber } from 'bignumber.js/bignumber'
import { prettySafeJson } from '../util'

export default interface ExchangeRateDao {
  record(retrievedAt: number, rateUsd: string): Promise<ExchangeRate>
  latest(): Promise<ExchangeRate>
  getLatestUsdRate(): Promise<BigNumber>
  getUsdRateAtTime(date: Date): Promise<BigNumber>
}

export class PostgresExchangeRateDao implements ExchangeRateDao {
  private engine: DBEngine<Client>

  constructor(engine: DBEngine<Client>) {
    this.engine = engine
  }

  public async record(
    retrievedAt: number,
    rateUsd: string,
  ): Promise<ExchangeRate> {
    return this.inflateRow(
      await this.engine.queryOne(SQL`
        INSERT INTO exchange_rates 
          (retrievedat, base, rate_usd)
        VALUES (${retrievedAt}, ${CurrencyCode.ETH.toString()}, ${rateUsd}) 
        RETURNING *
      `),
    )
  }

  public async latest() {
    return this.inflateRow(
      await this.engine.queryOne(
        'SELECT * FROM exchange_rates ORDER BY retrievedat DESC LIMIT 1',
      ),
    )
  }

  public async getLatestUsdRate(): Promise<BigNumber> {
    return await this.getUsdRateAtTime(new Date())
  }

  public async getUsdRateAtTime(date: Date): Promise<BigNumber> {
    const res = this.inflateRow(await this.engine.queryOne(SQL`
      SELECT *
      FROM exchange_rates
      WHERE retrievedat < ${+date}
      ORDER BY retrievedat DESC
      LIMIT 1
    `))

    if (res.retrievedAt < (+date) - 1000 * 60 * 60 * 24) {
      throw new Error(
        `Exchange rate nearest ${date} (${prettySafeJson(res)}) ` +
        `is more than 24 hours older than the date; refusing to use it.`,
      )
    }
    return res.rates['USD']
  }

  private inflateRow(row: any): ExchangeRate {
    return (
      row && {
        id: row.id,
        retrievedAt: row.retrievedat,
        base: row.base,
        rates: {
          [CurrencyCode.USD.toString()]: Big(row.rate_usd),
        },
      }
    )
  }
}
