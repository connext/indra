import GlobalSettings from '../domain/GlobalSettings'
import DBEngine from '../DBEngine'
import {Client} from 'pg'

export default interface GlobalSettingsDao {
  toggleWithdrawalsEnabled(status: boolean): Promise<void>

  togglePaymentsEnabled(status: boolean): Promise<void>

  fetch(): Promise<GlobalSettings>
}

export class PostgresGlobalSettingsDao implements GlobalSettingsDao {
  private engine: DBEngine<Client>

  constructor (engine: DBEngine<Client>) {
    this.engine = engine
  }

  toggleWithdrawalsEnabled (status: boolean): Promise<void> {
    return this.engine.exec(async (c: Client) => await c.query(
      'UPDATE global_settings SET withdrawals_enabled = $1',
      [
        status
      ]
    )) as Promise<any>
  }

  togglePaymentsEnabled (status: boolean): Promise<void> {
    return this.engine.exec(async (c: Client) => await c.query(
      'UPDATE global_settings SET payments_enabled = $1',
      [
        status
      ]
    )) as Promise<any>
  }

  fetch (): Promise<GlobalSettings> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM global_settings LIMIT 1',
      )

      const row = res.rows[0]

      return {
        withdrawalsEnabled: row.withdrawals_enabled,
        paymentsEnabled: row.payments_enabled,
      }
    })
  }
}
