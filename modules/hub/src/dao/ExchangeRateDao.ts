import { Client } from 'pg'

import DBEngine, { SQL } from '../DBEngine'
import CurrencyCode from '../domain/CurrencyCode'
import ExchangeRate from '../domain/ExchangeRate'
import { prettySafeJson } from '../util'

export default interface ExchangeRateDao {
  record(retrievedAt: number, rateDai: string): Promise<ExchangeRate>
  latest(): Promise<ExchangeRate>
  getLatestDaiRate(): Promise<string>
  getDaiRateAtTime(date: Date): Promise<string>
}

export class PostgresExchangeRateDao implements ExchangeRateDao {
  private engine: DBEngine<Client>

  public constructor(engine: DBEngine<Client>) {
    this.engine = engine
  }

  public async record(
    retrievedAt: number,
    rateDai: string,
  ): Promise<ExchangeRate> {
    return this.inflateRow(
      await this.engine.queryOne(SQL`
        INSERT INTO exchange_rates
          (retrievedat, base, rate_usd)
        VALUES (${retrievedAt}, ${CurrencyCode.ETH}, ${rateDai})
        RETURNING *
      `),
    )
  }

  public async latest(): Promise<any> {
    return this.inflateRow(
      await this.engine.queryOne(
        'SELECT * FROM exchange_rates ORDER BY retrievedat DESC LIMIT 1',
      ),
    )
  }

  public async getLatestDaiRate(): Promise<string> {
    return this.getDaiRateAtTime(new Date())
  }

  public async getDaiRateAtTime(date: Date): Promise<string> {
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
    return res.rates.DAI
  }

  private inflateRow(row: any): ExchangeRate {
    return (
      row && {
        base: row.base,
        id: row.id,
        rates: {
          ['DAI']: row.rate_usd,
        },
        retrievedAt: row.retrievedat,
      }
    )
  }

}
