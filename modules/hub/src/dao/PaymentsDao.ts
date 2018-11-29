import * as BigNumber from 'bignumber.js'
import DBEngine from '../DBEngine'
import {Client} from 'pg'
import {TotalsTuple} from '../domain/TotalsTuple'
import {PaymentChannel, PaymentChannelSerde} from 'machinomy/dist/lib/payment_channel'
import log from '../util/log'
import Config from '../Config'

export default interface PaymentsDao {
  totalAvailableFor (address: string): Promise<TotalsTuple>

  staleChannels(): Promise<PaymentChannel[]>
}

const LOG = log('PostgresPaymentsDao')

export class PostgresPaymentsDao implements PaymentsDao {
  private engine: DBEngine<Client>

  private config: Config

  private staleChannelMs: number

  constructor (engine: DBEngine<Client>, config: Config) {
    this.engine = engine
    this.config = config;
    this.staleChannelMs = config.staleChannelDays * 24 * 60 * 60 * 1000;
  }

  public totalAvailableFor (address: string): Promise<TotalsTuple> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(`
          SELECT
            SUM(p.amountwei) as totalwei,
            SUM(p.amountusd) as totalusd
          FROM payments AS p
          LEFT JOIN withdrawals AS w ON w.id = p.withdrawal_id
          WHERE
            receiver = $1 AND
            (withdrawal_id IS NULL OR w.status = 'FAILED')
      `, [ address ])

      const row = res.rows[0]

      if ((!row.totalwei && row.totalusd) ||
        (row.totalwei && !row.totalusd)) {
        LOG.warn('For some reason, either total wei or total USD is null when the other ' +
          'is not. This should not happen. Total Wei: {totalWei}, Total USD: {totalUsd}', {
          totalWei: row.totalwei,
          totalUsd: row.totalusd,
        })
      }

      if (!row.totalwei || !row.totalusd) {
        return {
          totalWei: new BigNumber.BigNumber(0),
          totalUsd: new BigNumber.BigNumber(0)
        }
      }

      return {
        totalWei: new BigNumber.BigNumber(row.totalwei),
        totalUsd: new BigNumber.BigNumber(row.totalusd)
      }
    })
  }

  public staleChannels (): Promise<PaymentChannel[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM channel WHERE "channelId" IN 
            (SELECT "channelId" FROM payments 
            GROUP BY "channelId" 
            HAVING now_millis() - MAX(created_at) > $1
          );`,
        [
          this.staleChannelMs
        ]
      )

      return res.rows.map(PaymentChannelSerde.instance.deserialize)
    })
  }
}
