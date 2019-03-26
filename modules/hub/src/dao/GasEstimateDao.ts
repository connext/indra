import {Client} from 'pg'
import DBEngine from '../DBEngine'
import {RedisClient} from '../RedisClient'
import GasEstimate from '../domain/GasEstimate'
import log from '../util/log'

const LOG = log('GasEstimateDao')

export default interface GasEstimateDao {
  record(estimate: GasEstimate): Promise<GasEstimate>
  latest(): Promise<GasEstimate | null>
}

// mapping keys between JavaScript <> Postgres
const keyMapping = [
  ['retrievedAt', 'retrieved_at'],

  ['speed', 'speed'],
  ['blockNum', 'block_num'],
  ['blockTime', 'block_time'],

  ['fastest', 'fastest'],
  ['fastestWait', 'fastest_wait'],

  ['fast', 'fast'],
  ['fastWait', 'fast_wait'],

  ['average', 'average'],
  ['avgWait', 'avg_wait'],

  ['safeLow', 'safe_low'],
  ['safeLowWait', 'safe_low_wait'],
]

export class PostgresGasEstimateDao implements GasEstimateDao {
  private db: DBEngine<Client>
  private redis: RedisClient

  // By default, expire the redis key after 1 day. This number is, at the
  // moment, entirely arbitrary... but in the future, once we've got some data,
  // we can pick it based on "how long, on average, does it take to see
  // meaningful changes in the gas price?"
  private REDIS_KEY_TIMEOUT_SECONDS = 60 * 60 * 24
  private REDIS_KEY = 'gas-estimate-latest'

  constructor (db: DBEngine<Client>, redis: RedisClient) {
    this.db = db
    this.redis = redis
  }

  public async record(estimate: GasEstimate): Promise<GasEstimate> {
    const latest = await this.latest()
    if (latest && estimate.blockNum <= latest.blockNum)
      return latest

    const keys = keyMapping.map(k => k[1])
    const values = keyMapping.map(k => (estimate as any)[k[0]])
    await this.db.query(`
      INSERT INTO gas_estimates (${keys})
      VALUES (${values.map((_, idx) => `$${idx + 1}`)})
      ON CONFLICT (block_num) DO NOTHING
    `, values)

    LOG.debug(`${this.REDIS_KEY} ${this.REDIS_KEY_TIMEOUT_SECONDS} ${JSON.stringify(estimate)}`)
    await this.redis.setex(this.REDIS_KEY, this.REDIS_KEY_TIMEOUT_SECONDS, JSON.stringify(estimate))
    return estimate
  }

  public async latest(): Promise<GasEstimate | null> {
    const res = await this.redis.get(this.REDIS_KEY)
    if (!res)
      return null

    return JSON.parse(res)
  }

  private inflateRow(row: any): GasEstimate {
    const res: any = {}
    keyMapping.forEach(k => res[k[0]] = row[k[1]])
    return res
  }
}

