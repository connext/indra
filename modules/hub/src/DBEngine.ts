import { Client, ClientBase, Pool, PoolClient, QueryResult } from 'pg'

import Config from './Config'
import {Context} from './Container'
import { Logger } from './util'
import patch from './util/patch'

export const SQL = require('sql-template-strings')

export type Executor<T, U> = (client: T) => Promise<U>

export class TxnOptions {
  public savepoint: boolean = false
}

export type CommitCallback = (db?: DBEngine) => any | Promise<any>

export default interface DBEngine<T=Client> {
  log: Logger
  connect(): Promise<void>
  disconnect(): Promise<void>
  exec<U>(executor: Executor<T, U>): Promise<U>
  query<U>(query: string, params?:any[]): Promise<QueryResult>
  queryOne<U>(query: string, params?:any[]): Promise<any>
  withTransaction<Res>(options: TxnOptions, callback: Executor<PgTransaction, Res>): Promise<Res>
  withTransaction<Res>(callback: Executor<PgTransaction, Res>): Promise<Res>
  withFreshConnection<Res>(callback: Executor<PgTransaction, Res>): Promise<Res>
  onTransactionCommit(callback: CommitCallback): Promise<void>
}

function parseWithTxnArgs(args: any[]): [TxnOptions, (cxn: PgTransaction) => Promise<any>] {
  let callback: (cxn: PgTransaction) => Promise<any>
  let options = new TxnOptions()
  if (args.length === 1) {
    callback = args[0]
  } else if (args.length === 2) {
    options = {
      ...options,
      ...args[0],
    }
    callback = args[1]
  } else {
    throw TypeError(`Too many arguments to withTransaction: ${args.length}`)
  }
  return [options, callback]
}

/**
 * Runs `query` to clean up in response to error `e`.
 * If the query results in an error, log `e` then re-raise the query error.
 */
const cleanup = async (e: Error, cxn: any, query: string, log: Logger): Promise<any> => {
  try {
    return await cxn.query(query)
  } catch (newErr) {
    log.error(`Error while running "${query}" (${newErr}) which was run because of: ` +
      `${e} ${e.stack}`)
    throw newErr
  }
}

let savepointCounter = 0

export class PgTransaction implements DBEngine {
  public cxn: ClientBase
  public dbEngine: DBEngine
  public commitCallbacks: CommitCallback[] = []
  public log: Logger

  /**
   * Where pgUrl can either be a connection string:
   *
   *   postgres://user:password@host/database
   *
   * Or a connection object:
   *
   *   { user, password, host, port, database, ... }
   */
  constructor(dbEngine: DBEngine, cxn: ClientBase) {
    this.cxn = cxn
    this.dbEngine = dbEngine
    this.log = dbEngine.log
  }

  /**
   * Perform a query.
   */
  query(query: string, params?:any[]): Promise<QueryResult> {
    return this.cxn.query(query, params)
  }

  async queryOne(query: string, params?:any[]): Promise<any | null> {
    return (await this.cxn.query(query, params)).rows[0]
  }

  connect(): Promise<void> {
    // Do nothing
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    // Do nothing
    return Promise.resolve()
  }

  exec<U>(executor: Executor<Client, U>): Promise<U> {
    return executor.call(null, this.cxn)
  }

  withTransaction<Res>(options: TxnOptions, callback: Executor<PgTransaction, Res>): Promise<Res>
  withTransaction<Res>(callback: Executor<PgTransaction, Res>): Promise<Res>
  async withTransaction(...args: any[]) {
    let [options, callback] = parseWithTxnArgs(args)
    if (!options.savepoint) {
      try {
        return await callback(this)
      } catch (e) {
        try {
          // put the connection in an invalid state to make sure all future
          // commands fail. There may be a better way to do this... but this
          // works well enough.
          await this.cxn.query(`do $$ begin raise exception 'xxx-abort-transaction-xxx'; end $$`)
        } catch (e) {
          if (('' + e).indexOf('xxx-abort-transaction-xxx') < 0)
            throw e
        }

        throw e
      }
    }

    const savepointName = 'savepoint_' + ++savepointCounter
    await this.cxn.query('SAVEPOINT ' + savepointName)
    try {
      return await callback(this)
    } catch (e) {
      await cleanup(e, this.cxn, `ROLLBACK TO SAVEPOINT ${savepointName}`, this.log)
      throw e
    }
  }

  /**
   * Calls 'callback' when the current transaction commits.
   *
   * Note: the caller must always `await` this function, as the `DBEngine`
   * version may call the callback immediately, and the callback may be async.
   *
   * Note that 'callback' will not be called:
   * 1. If the transaction aborts, and
   * 2. After savepoints (only after the entire transaction commits).
   */
  onTransactionCommit(callback: CommitCallback): Promise<void> {
    this.commitCallbacks.push(callback)
    return Promise.resolve()
  }

  /**
   * Returns a fresh database connection, outside the currently pending
   * transaction (if one exists).
   */
  withFreshConnection<Res>(callback: Executor<PgTransaction, Res>): Promise<Res> {
    return this.dbEngine.withFreshConnection(callback)
  }

}

/**
 * A singleton service which lets all active threads share a single connection
 * pool.
 */
let poolCount = 0
export class PgPoolService {
  public pool: Pool
  public log: Logger

  constructor(config: Config) {
    this.log = new Logger('PgPoolService:' + ++poolCount, config.logLevel)
    this.pool = this._initPool(config)
  }

  private _initPool(config: Config): Pool {
    const pool = new Pool({
      connectionString: config.databaseUrl,
      min: 1,
      max: 10,
      idleTimeoutMillis: 10 * 1000,
    })

    pool.on('error', err => {
      // This will happen if there's a connection error from one of the
      // connections idle in the pool. This will probably happen if Postgres
      // reboots or similar, and is likely okay to ignore... but I want to
      // keep this at log.error for the moment just to be sure.
      this.log.error('Error from idle Postgres connection (probably safe to ignore): ' + err)
    })

    pool.on('acquire', _client => {
      let client: any = _client as any

      if (!client._scOriginalMethods) {
        client._scOriginalMethods = {
          query: client.query,
          release: client.release,
        }
      }

      client.query = client._scOriginalMethods.query
      client.release = () => {
        client._scOriginalMethods.release.call(client)
        client.query = (...args: any[]) => {
          return client._scOriginalMethods.query.apply(client, args)
        }
      }
    })

    var connectCount = 0
    pool.on('connect', () => {
      connectCount += 1
      this.log.debug(`Allocating new Postgres connection (active connections: ${connectCount})`)
    })

    pool.on('remove', () => {
      connectCount -= 1
      this.log.debug(`Removing Postgres connection from pool (active connections: ${connectCount})`)
    })

    return pool
  }

  async close() {
    await this.pool.end()
  }
}

export class PostgresDBEngine implements DBEngine<Client> {
  private context?: Context
  private pool: Pool
  public log: Logger

  constructor(config: Config, pool: PgPoolService, context?: Context) {
    this.context = context
    this.pool = pool.pool
    this.log = new Logger('PostgresDBEngine', config.logLevel)
  }

  async connect(): Promise<void> {
    // Pool will connect automatically on demand
  }

  async disconnect(): Promise<void> {
    // The pool will still be valid and useable after being end-ed, so no
    // reason to null it out.
    await this.pool.end()
  }

  private getActiveTransaction(): PgTransaction {
    return this.context && this.context.get('pgTransaction', null)
  }

  async exec<U>(executor: Executor<Client, U>): Promise<U> {
    const cxn = this.getActiveTransaction()
    if (cxn)
      return executor(cxn.cxn as Client)

    const client = (
      await this.pool.connect()
    )

    try {
      return await executor.call(null, client)
    } finally {
      client.release()
    }
  }

  public async query(query: string, params?:any[]): Promise<QueryResult> {
    const cxn = this.getActiveTransaction()
    if (cxn) {
      return cxn.query(query, params)
    }
    return this.pool.query(query, params)
  }

  public async queryOne(query: string, params?:any[]): Promise<any | null> {
    return (await this.query(query, params)).rows[0]
  }

  /**
   * Returns a connection inside a transaction.
   *
   * The transaction will be committed if the function returns, or rolled
   * back if an exception is thrown.
   */
  withTransaction<Res>(options: TxnOptions, callback: Executor<PgTransaction, Res>): Promise<Res>
  withTransaction<Res>(callback: Executor<PgTransaction, Res>): Promise<Res>
  async withTransaction(...args: any[]) {
    let [options, callback] = parseWithTxnArgs(args)

    const curTxn = this.getActiveTransaction()
    if (curTxn)
      return curTxn.withTransaction(options, callback)

    let res
    const cxn = await this.pool.connect()
    const txn = new PgTransaction(this, cxn)
    try {
      await txn.query('BEGIN')
      this.context && this.context.set('pgTransaction', txn)
      if (!this.context) {
        // This *should* never happen. See the rules described on the `Context`
        // class.
        this.log.warn(
          `DBEngine.withTransaction(...) used without a Context available. ` +
          `The transaction will not be automatically shared with callers.`
        )
      }

      res = await callback(txn)
      await cxn.query('COMMIT')
    } catch (e) {
      await cleanup(e, cxn, 'ROLLBACK', this.log)
      throw e
    } finally {
      this.context && this.context.set('pgTransaction', null)
      cxn.release()
    }
    await Promise.all(txn.commitCallbacks.map(cb => cb(this)))
    return res
  }

  /**
   * Returns a fresh database connection, outside the currently pending
   * transaction (if one exists).
   */
  async withFreshConnection<Res>(callback: Executor<PgTransaction, Res>): Promise<Res> {
    const client = await this.pool.connect()
    try {
      return await callback.call(null, client)
    } finally {
      client.release()
    }
  }

  /**
   * Calls 'callback' when the current transaction commits, or immediately if
   * no transaction is currently active.
   *
   * Note: the caller must always `await` this function, as the callback may
   * be called, and the callback may be asynchronous.
   *
   * Note that 'callback' will not be called:
   * 1. If the transaction aborts, and
   * 2. After savepoints (only after the entire transaction commits).
   */
  async onTransactionCommit(callback: CommitCallback): Promise<void> {
    let txn = this.getActiveTransaction()
    if (txn) {
      txn.onTransactionCommit(callback)
    } else {
      await callback(this)
    }
  }

}


/**
 * Postgres Monkeypatch
 */

let RealPGConnection = require('pg/lib/connection')

// Errors that come back from Postgres can be unhelpful when raw SQL is
// involved because it doesn't include the position or line number of the
// error. Monkeypatch the pg library so the error message includes both
// position and line number.
patch(RealPGConnection.prototype, 'query', function(this: any, old: any, text: any) {
  this.__lastQuery = text
  return old.call(this, text)
})

patch(RealPGConnection.prototype, 'parseE', function(this: any, old: any, ...args: any[]) {
  let res = old.apply(this, args)
  let pos = res.position
  if (!pos || res.__didPatchMessage)
    return res

  pos = +pos
  let lineno = 1
  let lastQuery = this.__lastQuery || ''
  for (let i = 0; i < lastQuery.length; i += 1) {
    if (lastQuery[i] == '\n')
      lineno += 1
    if (i >= pos)
      break
  }
  res.message += ` (position: ${pos}; line: ${lastQuery ? lineno : 'unknown'})`
  res.__didPatchMessage = true
  return res
})
