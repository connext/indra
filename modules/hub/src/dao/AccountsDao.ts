import { Client } from 'pg'
import { Migration, WalletMigrations } from '../domain/WalletMigrations'
import DBEngine from '../DBEngine'

export default interface AccountsDao {
  getMigrations(address: string): Promise<WalletMigrations>

  applyMigrations(address:string, ids: Array<number>): Promise<void>
}

export class PostgresAccountsDao implements AccountsDao {
  private engine: DBEngine<Client>

  constructor(engine: DBEngine<Client>) {
    this.engine = engine
  }

  getMigrations(address: string): Promise<WalletMigrations> {
    return this.engine.exec(async (c: Client) => {
      const response: WalletMigrations = {
        applied: [],
        unapplied: []
      }
      const res = await c.query(
        `SELECT COALESCE(awm.migration_id, avm.id) AS migration_id, avm.migration_name, awm.applied_at
          FROM available_wallet_migrations AS avm
            LEFT JOIN applied_wallet_migrations AS awm
              ON (awm.migration_id = avm.id) AND (awm.wallet_address = $1)
          ORDER BY migration_id, applied_at ASC`,
        [address]
      )

      res.rows.forEach(row => {
        const inflated = this.inflateRow(row)

        if (row.applied_at) {
          response.applied.push(inflated)
        } else {
          response.unapplied.push(inflated)
        }
      })

      return response
    })
  }

  applyMigrations(address: string, ids: Array<number>): Promise<void> {
    // Ensure wallet has applied valid migrations
    return this.engine.exec(async (c: Client) => {
      await c.query('BEGIN')
      try {
        // Check ids are valid
        if (!ids.length) {
          throw new Error('migration ids array is empty')
        }

        const validIds = await c.query(
          `SELECT id FROM available_wallet_migrations WHERE id = ANY ($1)`,
          [ids]
        )

        if (validIds.rows.length !== ids.length) {
          throw new Error('migration ids are invalid')
        }
        // Check ids in order
        let last = ids[0] - 1

        ids.forEach(id => {
          if ((id - last) !== 1) {
            throw new Error('migration ids out of order')
          }
          last = id
        })
        // Check ids are the next migrations needed
        const migrations: WalletMigrations = await this.getMigrations(address)
        const lastId = migrations.applied.length ? migrations.applied[migrations.applied.length - 1].migrationId : 0
        if ((ids[0] - lastId) !== 1) {
          throw new Error('migration ids are out of sequence')
        }

        await Promise.all(
          ids.map((id: number) => {
            return c.query(
              `INSERT INTO applied_wallet_migrations (migration_id, wallet_address)
              VALUES ($1, $2)`,
              [id, address]
            )
          })
        )
      } catch (e) {
        await c.query('ROLLBACK')
        throw e
      }
      await c.query('COMMIT')
    })
  }

  private inflateRow(row: any): Migration {
    return {
      migrationId: Number(row.migration_id),
      migrationName: row.migration_name,
      appliedAt: row.applied_at
    }
  }
}


