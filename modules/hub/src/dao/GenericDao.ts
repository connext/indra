import { Client } from 'pg'

import DBEngine from '../DBEngine'
import { Logger } from '../util'

export default interface GenericDao {
  asTransaction(queries: any[]): Promise<any>
}

export class PostgresGenericDao implements GenericDao {
  protected engine: DBEngine<Client>
  private log: Logger

  public constructor(engine: DBEngine<Client>) {
    this.engine = engine
    this.log = new Logger('GenericDao', this.engine.log.logLevel)
  }

  public async asTransaction(queries: any[]): Promise<any> {
    return this.engine.exec(async (c: Client) => {
      await c.query('BEGIN')
      try {
        for (const query of queries) {
          this.log.debug('inside asTransaction')
          await query()
        }
        await c.query('COMMIT')
      } catch (error) {
        await c.query('ROLLBACK')
        this.log.error(`Error during transaction query, rollback: ${error}`)
        throw error
      }
    })
  }
}
