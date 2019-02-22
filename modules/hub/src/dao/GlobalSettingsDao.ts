import GlobalSettings from '../domain/GlobalSettings'
import DBEngine from '../DBEngine'
import {Client} from 'pg'

export default interface GlobalSettingsDao {
  insertDefaults(): Promise<void>

  toggleWithdrawalsEnabled(status: boolean): Promise<void>

  togglePaymentsEnabled(status: boolean): Promise<void>

  toggleThreadsEnabled(status: boolean): Promise<void>

  fetch(): Promise<GlobalSettings>
}

export class PostgresGlobalSettingsDao implements GlobalSettingsDao {
  private engine: DBEngine<Client>

  private cache: GlobalSettings|null

  constructor (engine: DBEngine<Client>) {
    this.engine = engine
    this.cache = null
  }

  async insertDefaults () {
    await this.engine.exec(async (c: Client) => {
      await c.query('BEGIN');

      try {
        await c.query('TRUNCATE global_settings');
        await c.query(
          'INSERT INTO global_settings (withdrawals_enabled, payments_enabled, threads_enabled) VALUES (true, true, true)'
        );
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }

      await c.query('COMMIT');
    })

    this.cache = {
      withdrawalsEnabled: true,
      paymentsEnabled: true,
      threadsEnabled: true
    };
  }

  async toggleWithdrawalsEnabled (status: boolean): Promise<void> {
    await this.engine.exec(async (c: Client) => await c.query(
      'UPDATE global_settings SET withdrawals_enabled = $1',
      [
        status
      ]
    ))

    if (this.cache) {
      this.cache.withdrawalsEnabled = status
    }
  }

  async togglePaymentsEnabled (status: boolean): Promise<void> {
    await this.engine.exec(async (c: Client) => await c.query(
      'UPDATE global_settings SET payments_enabled = $1',
      [
        status
      ]
    ))

    if (this.cache) {
      this.cache.paymentsEnabled = status
    }
  }

  async toggleThreadsEnabled (status: boolean): Promise<void> {
    await this.engine.exec(async (c: Client) => await c.query(
      'UPDATE global_settings SET threads_enabled = $1',
      [
        status
      ]
    ))

    if (this.cache) {
      this.cache.threadsEnabled = status
    }
  }

  async fetch (): Promise<GlobalSettings> {
    if (this.cache) {
      return { ...this.cache }
    }

    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM global_settings LIMIT 1',
      )

      const row = res.rows[0]

      this.cache = {
        withdrawalsEnabled: row.withdrawals_enabled,
        paymentsEnabled: row.payments_enabled,
        threadsEnabled: row.threads_enabled
      }

      return this.cache
    })
  }
}
