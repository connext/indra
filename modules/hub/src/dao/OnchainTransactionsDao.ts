import { OnchainTransactionRow, TransactionMeta, UnconfirmedTransaction } from '../domain/OnchainTransaction'
import { default as DBEngine, SQL } from '../DBEngine'
import { assertUnreachable } from "../util/assertUnreachable";
import Config from '../Config';

export type TxnStateUpdate = (
  { state: 'submitted' } |
  { state: 'confirmed' | 'failed', blockNum: Number, blockHash: string, transactionIndex: number, reason?: any } |
  { state: 'failed', reason: string } |
  { state: 'pending_failure', reason: string }
)


export class OnchainTransactionsDao {
  constructor(private config: Config) {}

  async insertTransaction(db: DBEngine, logicalId: Number | null, meta: TransactionMeta, txn: UnconfirmedTransaction) {
    const res = await db.queryOne(SQL`
      INSERT INTO onchain_transactions_raw (
        logical_id,

        "from", "to", value, gas, gas_price,
        data, nonce, signature, hash,

        meta
      )

      values (
        coalesce(${logicalId || null}, nextval('onchain_transactions_raw_logical_id_seq')),

        ${txn.from}, ${txn.to}, ${txn.value}, ${txn.gas}, ${txn.gasPrice},
        ${txn.data}, ${txn.nonce}, ${JSON.stringify(txn.signature)}, ${txn.hash},

        ${JSON.stringify(meta)}
      )

      RETURNING *
    `)

    return this.inflateRow(res)
  }

  async getPending(db: DBEngine): Promise<OnchainTransactionRow[]> {
    const { rows } = await db.query(`
      SELECT *
      FROM onchain_transactions_raw
      WHERE
        state <> 'failed' AND
        state <> 'confirmed'
      FOR UPDATE
    `)

    return rows.map(row => this.inflateRow(row))
  }

  async getTransactionByLogicalId(db: DBEngine, logicalId: Number): Promise<OnchainTransactionRow | null> {
    const row = await db.queryOne(`
      SELECT *
      FROM onchain_transactions_raw
      WHERE logical_id = ${logicalId}
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
    `)

    return row && this.inflateRow(row)
  }

  async getLatestConfirmed(db: DBEngine, account: string): Promise<OnchainTransactionRow | null> {
    const row = await db.queryOne(SQL`
      SELECT *
      FROM onchain_transactions_raw
      WHERE
        "from" = ${account} AND
        state = 'confirmed'
      ORDER BY nonce DESC
      LIMIT 1
    `)

    return row && this.inflateRow(row)
  }

  async updateTransactionState(db: DBEngine, id: Number, s: TxnStateUpdate): Promise<OnchainTransactionRow> {
    let updates = SQL`state = ${s.state}, `.append(s.state + '_on').append(` = now() `)
    switch (s.state) {
      case 'submitted':
        break

      case 'confirmed':
        updates = updates.append(SQL`,
          block_num = ${s.blockNum},
          block_hash = ${s.blockHash},
          transaction_index = ${s.transactionIndex}
        `)
        break

      case 'failed':
        updates = updates.append(SQL`,
          failed_reason = ${s.reason}
        `)
        break
      
      case 'pending_failure':
        updates = updates.append(SQL`,
          failed_reason = ${s.reason}
        `)
        break

      default:
        assertUnreachable(s, 'unexpected state: ' + (s as any).state)
    }

    const row = await db.queryOne(SQL`
      UPDATE onchain_transactions_raw
      SET
      `.append(updates).append(SQL`
      WHERE id = ${id}
      RETURNING *
    `))

    return this.inflateRow(row)
  }

  private inflateRow(row: any): OnchainTransactionRow {
    return {
      'id': +row.id,
      'logicalId': +row.logical_id,
      'state': row.state,

      'from': row.from,
      'to': row.to,
      'value': row.value,
      'gas': +row.gas,
      'gasPrice': row.gas_price,
      'data': row.data,
      'nonce': +row.nonce,
      'signature': row.signature,
      'hash': row.hash,

      'meta': row.meta,

      'createdOn': row.created_on,
      'submittedOn': row.submitted_on,

      'confirmedOn': row.confirmed_on,
      'blockNum': row.block_num,
      'blockHash': row.block_hash,
      'transactionIndex': row.transaction_index,

      'pendingFailureOn': row.pending_failure_on,

      'failedOn': row.failed_on,
      'failedReason': row.failed_reason,
    }
  }

}
