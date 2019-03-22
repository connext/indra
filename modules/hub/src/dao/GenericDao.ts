import DBEngine from '../DBEngine'
import { Client } from 'pg'
import log from '../util/log'

const LOG = log('GenericDao')

export default interface GenericDao {
  asTransaction(queries: Function[]): Promise<any>
}

export class PostgresGenericDao implements GenericDao {
  protected engine: DBEngine<Client>

  constructor(engine: DBEngine<Client>) {
    this.engine = engine
  }

  async asTransaction(queries: Function[]): Promise<any> {
    return this.engine.exec(async (c: Client) => {
      await c.query('BEGIN')
      try {
        for (const query of queries) {
          LOG.debug('inside asTransaction');
          await query()
        }
        await c.query('COMMIT')
      } catch (error) {
        await c.query('ROLLBACK')
        LOG.error('Error during transaction query, rollback: {error}', {
          error,
        })
        throw error
      }
    })
  }
}
