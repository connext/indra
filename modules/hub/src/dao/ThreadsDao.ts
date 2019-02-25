import DBEngine, { SQL } from '../DBEngine'
import { Client } from 'pg'
import Config from '../Config'
import {
  ThreadStateBigNum,
  ThreadStateUpdateRowBigNum,
  ThreadRowBigNum,
} from '../domain/Thread'
import { BigNumber } from 'bignumber.js'
import { ThreadState, ThreadStatus } from '../vendor/connext/types'
import { getLastThreadUpdateId } from '../vendor/connext/lib/getLastThreadUpdateId';
import { getActiveThreads } from '../vendor/connext/lib/getActiveThreads';

export default interface ThreadsDao {
  applyThreadUpdate(
    update: ThreadState,
    senderOpenUpdateId?: number,
    receiverOpenUpdateId?: number,
    senderCloseUpdateId?: number,
    receiverCloseUpdateId?: number,
  ): Promise<ThreadStateUpdateRowBigNum>
  changeThreadStatus(
    sender: string,
    receiver: string,
    status: ThreadStatus,
  ): Promise<void>
  getThread(sender: string, receiver: string, threadId: number): Promise<ThreadRowBigNum | null>
  getActiveThread(
    sender: string,
    receiver: string,
  ): Promise<ThreadRowBigNum | null>
  getThreads(user: string): Promise<ThreadRowBigNum[]>
  getThreadsActive(user: string): Promise<ThreadRowBigNum[]>
  getLastThreadUpdateId(user: string): Promise<number>
  getThreadUpdateLatest(
    sender: string,
    receiver: string,
  ): Promise<ThreadStateUpdateRowBigNum | null>
  getThreadInitialStatesByUser(user: string): Promise<ThreadStateUpdateRowBigNum[]>
  getThreadUpdatesForSync(
    user: string,
    lastId: number,
  ): Promise<ThreadStateUpdateRowBigNum[]>
  getThreadsIncoming(user: string): Promise<ThreadRowBigNum[]>
  getCurrentTxCount(sender: string, receiver: string): Promise<number>
  getCurrentThreadId(sender: string, receiver: string): Promise<number>
}

export class PostgresThreadsDao implements ThreadsDao {
  private db: DBEngine<Client>

  private config: Config

  constructor(db: DBEngine<Client>, config: Config) {
    this.db = db
    this.config = config
  }

  public async applyThreadUpdate(
    update: ThreadState,
    senderOpenUpdateId?: number,
    receiverOpenUpdateId?: number,
    senderCloseUpdateId?: number,
    receiverCloseUpdateId?: number,
  ): Promise<ThreadStateUpdateRowBigNum> {
    return this.inflateThreadUpdate(
      await this.db.queryOne(SQL`
        SELECT *
        FROM cm_thread_insert_state(
          _sender_open_update_id := ${senderOpenUpdateId},
          _receiver_open_update_id := ${receiverOpenUpdateId},
          _sender_close_update_id := ${senderCloseUpdateId},
          _receiver_close_update_id := ${receiverCloseUpdateId},
          update_obj := ${update}
        )
      `)
    )
  }

  public async changeThreadStatus(
    sender: string,
    receiver: string,
    status: ThreadStatus,
  ): Promise<void> {
    await this.db.queryOne(SQL`
      SELECT cm_thread_update_status(
        _thread_pk := (
          SELECT id FROM cm_threads
          WHERE
            contract = ${this.config.channelManagerAddress} AND
            sender = ${sender} AND
            receiver = ${receiver}
            AND status != 'CT_CLOSED'
        ),
        _status := ${status}
      ) as res
    `)
  }

  public async getCurrentTxCount(
    sender: string,
    receiver: string,
  ): Promise<number> {
    const { count } = await this.db.queryOne(SQL`
      SELECT COALESCE(MAX(tx_count), 0) AS count 
      FROM cm_threads
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        sender = ${sender} AND
        receiver = ${receiver} AND
        status = 'CT_OPEN'
    `)
    return parseInt(count)
  }

  public async getCurrentThreadId(
    sender: string,
    receiver: string,
  ): Promise<number> {
    const { thread_id } = await this.db.queryOne(SQL`
      SELECT COALESCE(MAX(thread_id), 0) AS thread_id
      FROM cm_threads
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        sender = ${sender} AND
        receiver = ${receiver}
    `)
    return parseInt(thread_id)
  }

  public async getThread(
    sender: string,
    receiver: string,
    threadId: number
  ): Promise<ThreadRowBigNum | null> {
    return this.inflateThreadRow(
      await this.db.queryOne(SQL`
      SELECT *
      FROM cm_threads
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        sender = ${sender} AND
        receiver = ${receiver} AND
        thread_id = ${threadId}
    `),
    )
  }

  public async getActiveThread(
    sender: string,
    receiver: string,
  ): Promise<ThreadRowBigNum | null> {
    return this.inflateThreadRow(
      await this.db.queryOne(SQL`
      SELECT *
      FROM cm_threads
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        sender = ${sender} AND
        receiver = ${receiver} AND
        status <> 'CT_CLOSED'
    `),
    )
  }

  public async getThreads(
    user: string,
  ): Promise<ThreadRowBigNum[]> {
    const { rows } = await this.db.query(SQL`
      SELECT *
      FROM cm_threads
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        (sender = ${user} OR receiver = ${user})
    `)
    return rows.map(row => this.inflateThreadRow(row))
  }

  public async getThreadsActive(
    user: string,
  ): Promise<ThreadRowBigNum[]> {
    const { rows } = await this.db.query(SQL`
      SELECT *
      FROM cm_threads
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        (sender = ${user} OR receiver = ${user}) AND
        status <> 'CT_CLOSED'
    `)
    return rows.map(row => this.inflateThreadRow(row))
  }

  public async getThreadById(id: number): Promise<ThreadRowBigNum> {
    return this.inflateThreadRow(
      await this.db.queryOne(SQL`
      SELECT * FROM cm_threads
      WHERE id = ${id}
    `),
    )
  }

  public async getThreadUpdateLatest(
    sender: string,
    receiver: string,
  ): Promise<ThreadStateUpdateRowBigNum | null> {
    return this.inflateThreadUpdate(
      await this.db.queryOne(SQL`
        SELECT *
        FROM cm_thread_updates
        WHERE
          contract = ${this.config.channelManagerAddress} AND
          sender = ${sender} AND
          receiver = ${receiver} AND
          status <> 'CT_CLOSED'
        ORDER BY tx_count DESC
        LIMIT 1
      `),
    )
  }

  public async getLastThreadUpdateId(
    user: string,
  ): Promise<number> {
    const up = this.inflateThreadUpdate(
      await this.db.queryOne(SQL`
      SELECT *
      FROM cm_thread_updates
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        (sender = ${user} OR receiver = ${user})
      ORDER BY id DESC
      LIMIT 1
      `),
    )
    return up && up.id ? up.id : 0
  }

  public async getThreadInitialStatesByUser(
    user: string,
  ): Promise<ThreadStateUpdateRowBigNum[]> {
    const { rows } = await this.db.query(SQL`
      SELECT *
      FROM cm_thread_updates
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        (sender = ${user} OR receiver = ${user}) AND
        thread_status <> 'CT_CLOSED' AND
        tx_count = 0
      ORDER BY thread_id DESC
      LIMIT 1
    `)
    return rows.map(row => this.inflateThreadUpdate(row))
  }

  public async getThreadUpdatesForSync(
    user: string,
    lastId: number,
  ): Promise<ThreadStateUpdateRowBigNum[]> {
    const { rows } = await this.db.query(SQL`
      SELECT *
      FROM cm_thread_updates
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        (sender = ${user} OR receiver = ${user}) AND
        status = 'CT_OPEN' AND
        id >= ${lastId}
      ORDER BY id ASC
    `)
    return rows.map(row => this.inflateThreadUpdate(row))
  }

  public async getThreadsIncoming(user: string): Promise<ThreadRowBigNum[]> {
    const { rows } = await this.db.query(SQL`
      SELECT *
      FROM cm_threads
      WHERE
        contract = ${this.config.channelManagerAddress} AND
        receiver = ${user} AND
        status = 'CT_OPEN'
    `)
    return rows.map(row => this.inflateThreadRow(row))
  }

  private inflateThreadRow(row: any): ThreadRowBigNum | null {
    return (
      row && {
        id: row.id,
        status: row.status,
        state: this.inflateThreadState(row)!,
      }
    )
  }

  private inflateThreadUpdate(row: any): ThreadStateUpdateRowBigNum | null {
    return (
      row && {
        id: row.id,
        state: this.inflateThreadState(row)!,
        createdOn: row.created_on,
      }
    )
  }

  private inflateThreadState(row: any): ThreadStateBigNum | null {
    if (row && !row.sig_a)
      throw new Error(JSON.stringify(row))
    return (
      row && {
        threadId: row.thread_id,
        contractAddress: row.contract,
        sender: row.sender,
        receiver: row.receiver,
        balanceWeiSender: new BigNumber(row.balance_wei_sender),
        balanceWeiReceiver: new BigNumber(row.balance_wei_receiver),
        balanceTokenSender: new BigNumber(row.balance_token_sender),
        balanceTokenReceiver: new BigNumber(row.balance_token_receiver),
        txCount: row.tx_count,
        sigA: row.sig_a,
      }
    )
  }
}
