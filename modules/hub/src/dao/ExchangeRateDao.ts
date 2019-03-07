import DBEngine, { SQL } from '../DBEngine'
import { Client } from 'pg'
import ExchangeRate from '../domain/ExchangeRate'
import CurrencyCode from '../domain/CurrencyCode'
import { Big } from '../util/bigNumber'

export default interface ExchangeRateDao {
  record(retrievedAt: number, rateUsd: string): Promise<ExchangeRate>
  latest(): Promise<ExchangeRate>
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
