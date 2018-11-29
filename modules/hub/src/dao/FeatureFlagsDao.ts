import FeatureFlags from '../domain/FeatureFlags'
import DBEngine from '../DBEngine'
import {Client} from 'pg'

export const DEFAULT_FLAGS: FeatureFlags = {
  bootySupport: true,
}

export default interface FeatureFlagsDao {
  flagsFor(address: string) : Promise<FeatureFlags>
}

export class PostgresFeatureFlagsDao implements FeatureFlagsDao {
  private client: DBEngine<Client>

  constructor (client: DBEngine<Client>) {
    this.client = client
  }

  public flagsFor (address: string): Promise<FeatureFlags> {
    return this.client.exec(async (c: Client) => {
      const res = await c.query(`
        SELECT *
        FROM feature_flags
        WHERE
          address in ($1, '0x0000000000000000000000000000000000000000')
        ORDER BY address DESC
        LIMIT 1
      `, [address])

      return this.inflateRowDefaults(res.rows.length ? res.rows[0] : null)
    })
  }

  private inflateRowDefaults(row: any): FeatureFlags {
    if (!row) {
      return {
        ...DEFAULT_FLAGS
      }
    }

    return {
      ...DEFAULT_FLAGS,
      bootySupport: row.booty_support
    }
  }
}
