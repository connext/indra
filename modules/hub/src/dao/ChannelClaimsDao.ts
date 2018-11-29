import DBEngine from '../DBEngine'
import { Client } from 'pg'
import { ChannelClaim, ChannelClaimStatus } from '../domain/ChannelClaim'

export default interface ChannelClaimsDao {
  byId(channelId: string): Promise<ChannelClaim | null>

  create(channelId: string): Promise<ChannelClaim>

  markPending(channelId: string): Promise<ChannelClaim>

  markConfirmed(channelId: string): Promise<ChannelClaim>

  markFailed(channelId: string): Promise<ChannelClaim>

  getAllOpenChannels(): Promise<string[]>
}

export class PostgresChannelClaimsDao implements ChannelClaimsDao {
  private engine: DBEngine<Client>

  constructor(engine: DBEngine<Client>) {
    this.engine = engine
  }

  byId(channelId: string): Promise<ChannelClaim | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM channel_claims WHERE channel_id = $1 ORDER BY createdat DESC LIMIT 1',
        [channelId],
      )

      const row = res.rows[0]

      if (!row) {
        return null
      }

      return this.inflateRow(row)
    })
  }

  create(channelId: string): Promise<ChannelClaim> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'INSERT INTO channel_claims (channel_id, status, createdat) VALUES ($1, $2, $3) RETURNING *',
        [channelId, ChannelClaimStatus.NEW.toString(), Date.now()],
      )

      const row = res.rows[0]
      return this.inflateRow(row)
    })
  }

  getAllOpenChannels(): Promise<string[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `
          SELECT "channelId" as channel_id
          FROM channel t1
          LEFT JOIN channel_claims t2 ON t2.channel_id = t1."channelId"
          WHERE t2.channel_id IS NULL
        ` 
      )
      return res.rows.map((r: any) => r.channel_id)
    })
  }


  markPending(channelId: string): Promise<ChannelClaim> {
    return this.markState(channelId, ChannelClaimStatus.PENDING)
  }

  markConfirmed(channelId: string): Promise<ChannelClaim> {
    return this.markState(channelId, ChannelClaimStatus.CONFIRMED)
  }

  markFailed(channelId: string): Promise<ChannelClaim> {
    return this.markState(channelId, ChannelClaimStatus.FAILED)
  }

  private markState(channelId: string, status: ChannelClaimStatus) {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        "UPDATE channel_claims SET status = $1 WHERE channel_id = $2 AND status != 'FAILED' RETURNING *",
        [status.toString(), channelId],
      )

      return this.inflateRow(res.rows[0])
    })
  }

  private inflateRow(row: any): ChannelClaim {
    return {
      channelId: row.channel_id,
      status: row.status,
      createdAt: Number(row.createdat),
      pendingAt: row.pendingat ? Number(row.pendingat) : null,
      confirmedAt: row.confirmedat ? Number(row.confirmedat) : null,
      failedAt: row.failedat ? Number(row.failedat) : null,
    }
  }
}
