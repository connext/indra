import * as Connext from '../Connext'
import DBEngine, { SQL } from "../DBEngine";
import { Client } from "pg";
import { OnchainTransactionRow } from "../domain/OnchainTransaction";
import Config from "../Config";
import { ChannelDisputeRow } from "../domain/ChannelDispute";

type DisputeStatus = Connext.types.DisputeStatus

export default interface ChannelDisputesDao {
  create(
    user: string, 
    reason: string, 
    startEventChainsawId?: number, 
    txn?: OnchainTransactionRow,
    disputeEndTime?: number
  ): Promise<ChannelDisputeRow>
  changeStatus(id: number, status: DisputeStatus): Promise<ChannelDisputeRow>
  setExitEvent(disputeId: number, chainsawId: number, disputeEndTime: number): Promise<ChannelDisputeRow>
  addStartExitOnchainTx(disputeId: number, txn: OnchainTransactionRow): Promise<ChannelDisputeRow>
  removeStartExitOnchainTx(disputeId: number): Promise<ChannelDisputeRow>
  addEmptyOnchainTx(disputeId: number, txn: OnchainTransactionRow): Promise<ChannelDisputeRow>
  removeEmptyOnchainTx(disputeId: number): Promise<ChannelDisputeRow>
  setEmptyEvent(disputeId: number, chainsawId: number): Promise<ChannelDisputeRow>
  getActive(user: string): Promise<ChannelDisputeRow>
}

export class PostgresChannelDisputesDao implements ChannelDisputesDao {
  constructor(private db: DBEngine<Client>, private config: Config) {
  }

  /**
   * Create a new instance of a dispute event. This can be initiated with an OnchainTransaction
   * (i.e. hub initiates dispute), or from a chainsaw event (i.e. user initiates dispute).
   * @param user 
   * @param reason 
   * @param startEventChainsawId 
   * @param txn 
   * @param disputeEndTime 
   */
  public async create(
    user: string, 
    reason: string, 
    startEventChainsawId?: number, 
    txn?: OnchainTransactionRow,
    disputeEndTime?: number
  ): Promise<ChannelDisputeRow> {
    return this.inflateRow(
      await this.db.queryOne(SQL`
        INSERT INTO _cm_channel_disputes(
          channel_id,
          started_on,
          reason,
          start_event_id,
          onchain_tx_id_start,
          dispute_period_ends
        ) VALUES (
          (
            SELECT id 
            FROM _cm_channels 
            WHERE 
              "user" = ${user} AND 
              contract = ${this.config.channelManagerAddress}
          ),
          NOW(),
          ${reason},
          ${startEventChainsawId},
          ${txn ? txn.logicalId : null},
          ${disputeEndTime}
        ) RETURNING *
      `)
    )
  }

  public async changeStatus(id: number, status: DisputeStatus): Promise<ChannelDisputeRow> {
    return this.inflateRow(
      await this.db.queryOne(SQL`
        UPDATE _cm_channel_disputes
        SET status = ${status}
        WHERE id = ${id}
        RETURNING *
      `)
    )
  }

  public async setExitEvent(disputeId: number, chainsawId: number, disputeEndTime: number): Promise<ChannelDisputeRow> {
    // if adding the start exit ID, we can presume that the status should be CD_IN_DISPUTE_PERIOD
    return this.inflateRow(
      await this.db.queryOne(SQL`
        UPDATE _cm_channel_disputes
        SET 
          status = 'CD_IN_DISPUTE_PERIOD',
          start_event_id = ${chainsawId},
          dispute_period_ends = ${disputeEndTime}
        WHERE id = ${disputeId}
        RETURNING *
      `)
    )
  }

  public async addStartExitOnchainTx(disputeId: number, txn: OnchainTransactionRow): Promise<ChannelDisputeRow> {
    return this.inflateRow(
      await this.db.queryOne(SQL`
        UPDATE _cm_channel_disputes
        SET onchain_tx_id_start = ${txn.logicalId}
        WHERE id = ${disputeId}
        RETURNING *
      `)
    )
  }

  public async removeStartExitOnchainTx(disputeId: number): Promise<ChannelDisputeRow> {
    return this.inflateRow(
      await this.db.queryOne(SQL`
        UPDATE _cm_channel_disputes
        SET onchain_tx_id_start = NULL
        WHERE id = ${disputeId}
        RETURNING *
      `)
    )
  }

  public async addEmptyOnchainTx(disputeId: number, txn: OnchainTransactionRow): Promise<ChannelDisputeRow> {
    return this.inflateRow(
      await this.db.queryOne(SQL`
        UPDATE _cm_channel_disputes
        SET onchain_tx_id_empty = ${txn.logicalId}
        WHERE id = ${disputeId}
        RETURNING *
      `)
    )
  }

  public async removeEmptyOnchainTx(disputeId: number): Promise<ChannelDisputeRow> {
    return this.inflateRow(
      await this.db.queryOne(SQL`
        UPDATE _cm_channel_disputes
        SET onchain_tx_id_empty = NULL
        WHERE id = ${disputeId}
        RETURNING *
      `)
    )
  }

  public async setEmptyEvent(disputeId: number, chainsawId: number): Promise<ChannelDisputeRow> {
    return this.inflateRow(
      await this.db.queryOne(SQL`
        UPDATE _cm_channel_disputes
        SET 
          empty_event_id = ${chainsawId},
          status = 'CD_FINISHED'
        WHERE id = ${disputeId}
        RETURNING *
      `)
    )
  }

  public async getActive(user: string): Promise<ChannelDisputeRow> {
    return this.inflateRow(
      await this.db.queryOne(SQL`
        SELECT * FROM cm_channel_disputes
        WHERE id = (
          SELECT id
          FROM _cm_channel_disputes
          WHERE
            channel_id = (
              SELECT id
              FROM cm_channels
              WHERE
                "user" = ${user} AND
                contract = ${this.config.channelManagerAddress}
            ) AND
            status IN ('CD_PENDING', 'CD_IN_DISPUTE_PERIOD')
          FOR UPDATE
        )
      `)
    )
  }

  private inflateRow(row: any): ChannelDisputeRow {
    return row && {
      id: +row.id,
      channelId: +row.channel_id,
      startedOn: row.started_on,
      reason: row.reason,
      onchainTxIdStart: row.onchain_tx_id_start && +row.onchain_tx_id_start,
      onchainTxIdEmpty: row.onchain_tx_id_empty && +row.onchain_tx_id_empty
    }
  }
}
