import DBEngine from '../DBEngine'
import { Client } from 'pg'
import {
  VirtualChannel,
  VirtualChannelDto,
  VcStateUpdateDto,
  VcStateUpdate,
} from '../domain/VirtualChannel'
import { BigNumber } from 'bignumber.js'
import GenericDao, { PostgresGenericDao } from './GenericDao'

export enum VcStatus {
  Opening = 'VCS_OPENING',
  Opened = 'VCS_OPENED',
  Settling = 'VCS_SETTLING',
  Settled = 'VCS_SETTLED',
}

export default interface VirtualChannelsDao extends GenericDao {
  create(
    channel: VirtualChannelDto,
    initialState: VcStateUpdateDto,
  ): Promise<VirtualChannel>
  join(channelId: string, sigB: string): Promise<VirtualChannel | null>
  close(channelId: string): Promise<String>
  openingChannelsFor(address: string): Promise<VirtualChannel[]>
  openChannelsFor(address: string): Promise<VirtualChannel[]>
  channelById(channelId: string): Promise<VirtualChannel | null>
  openChannelByParties(
    partyA: string,
    partyB: string,
  ): Promise<VirtualChannel | null>
  initialStatesForSubchan(subchan: string): Promise<VirtualChannel[]>
  vcsForSubchan(subchan: string): Promise<VirtualChannel[]>

  createUpdate(
    channelId: string,
    update: VcStateUpdateDto,
  ): Promise<VcStateUpdate>
  cosignUpdate(
    channelId: string,
    nonce: number,
    sig: string,
  ): Promise<VcStateUpdate>
  getUpdate(channelId: string, nonce: number): Promise<VcStateUpdate | null>
  getUpdateById(id: number): Promise<VcStateUpdate | null>
  getLatestUpdate(channelId: string): Promise<VcStateUpdate | null>
  getLatestSignedUpdate(channelId: string): Promise<VcStateUpdate | null>
}

export class PostgresVirtualChannelsDao extends PostgresGenericDao
  implements VirtualChannelsDao {
  constructor(client: DBEngine<Client>) {
    super(client)
  }

  public create(
    channel: VirtualChannelDto,
    initialState: VcStateUpdateDto,
  ): Promise<VirtualChannel> {
    return this.engine.exec(async (c: Client) => {
      const vcRes = await c.query(
        `INSERT INTO virtual_channels(
          channel_id, party_a, party_b, party_i, subchan_a_to_i, subchan_b_to_i, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'VCS_OPENING') RETURNING *`,
        [
          channel.channelId,
          channel.partyA,
          channel.partyB,
          channel.partyI,
          channel.subchanAtoI,
          channel.subchanBtoI,
        ],
      )
      const vc = vcRes.rows[0]

      const vcsuRes = await c.query(
        `INSERT INTO virtual_channel_state_updates(
          channel_id,
          nonce,
          wei_balance_a,
          wei_balance_b,
          erc20_balance_a,
          erc20_balance_b,
          price_wei,
          price_erc20,                                         
          sig_a,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          channel.channelId,
          0,
          initialState.ethBalanceA.toString(),
          initialState.ethBalanceB.toString(),
          initialState.tokenBalanceA.toString(),
          initialState.tokenBalanceB.toString(),
          0,
          0,
          initialState.sigA,
          Date.now()
        ],
      )
      const vcsu = vcsuRes.rows[0]
      return this.inflateRow({ ...vc, ...vcsu })
    })
  }

  public async join(
    channelId: string,
    sigB: string,
  ): Promise<VirtualChannel | null> {
    return this.engine.exec(async (c: Client) => {
      const vcRes = await c.query(
        `UPDATE virtual_channels SET status = 'VCS_OPENED' WHERE channel_id = $1 RETURNING *`,
        [channelId],
      )
      const vc = vcRes.rows[0]

      const vcsuRes = await c.query(
        `UPDATE virtual_channel_state_updates SET sig_b = $2 WHERE channel_id = $1 AND nonce = 0 RETURNING *`,
        [channelId, sigB],
      )
      const vcsu = vcsuRes.rows[0]
      return this.inflateRow({ ...vc, ...vcsu })
    })
  }

  public async close(channelId: string): Promise<String> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `UPDATE virtual_channels SET status = 'VCS_SETTLED' WHERE channel_id = $1 RETURNING *`,
        [channelId],
      )
      return channelId
    })
  }

  public async openingChannelsFor(address: string): Promise<VirtualChannel[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        "SELECT * FROM hub_virtual_channels WHERE status = 'VCS_OPENING' AND (party_a = $1 OR party_b = $1)",
        [address],
      )

      return res.rows.map((r: any) => {
        return this.inflateRow(r)
      })
    })
  }

  public async openChannelsFor(address: string): Promise<VirtualChannel[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        "SELECT * FROM virtual_channels WHERE status = 'VCS_OPENED' AND (party_a = $1 OR party_b = $1)",
        [address],
      )

      return res.rows.map((r: any) => {
        return this.inflateRow(r)
      })
    })
  }

  public async initialStatesForSubchan(
    subchan: string,
  ): Promise<VirtualChannel[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `
        SELECT * 
        FROM virtual_channels vc
        LEFT OUTER JOIN (
          SELECT * 
          FROM virtual_channel_state_updates 
          WHERE nonce = 0
        ) vcsu
        ON vc.channel_id = vcsu.channel_id
        WHERE (vc.subchan_a_to_i = $1 OR vc.subchan_b_to_i = $1) AND (vc.status = 'VCS_OPENING' OR vc.status = 'VCS_OPENED' OR vc.status = 'VCS_SETTLING')
      `,
        [subchan],
      )

      return res.rows.map((r: any) => {
        return this.inflateRow(r)
      })
    })
  }

  public async vcsForSubchan(subchan: string): Promise<VirtualChannel[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * 
        FROM hub_virtual_channels
        WHERE (subchan_a_to_i = $1 OR subchan_b_to_i = $1) AND (status = 'VCS_OPENING' OR status = 'VCS_OPENED' OR status = 'VCS_SETTLING')`,
        [subchan],
      )

      return res.rows.map((r: any) => {
        return this.inflateRow(r)
      })
    })
  }

  public async channelById(channelId: string): Promise<VirtualChannel | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * from hub_virtual_channels WHERE channel_id = $1 LIMIT 1',
        [channelId],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]

      return this.inflateRow(row)
    })
  }

  public async openChannelByParties(
    partyA: string,
    partyB: string,
  ): Promise<VirtualChannel | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * from hub_virtual_channels 
        WHERE party_a = $1 
          AND party_b = $2 
          AND (status = 'VCS_OPENING' OR status = 'VCS_OPENED' OR status = 'VCS_SETTLING') 
        LIMIT 1`,
        [partyA, partyB],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]

      return this.inflateRow(row)
    })
  }

  public async createUpdate(
    channelId: string,
    update: VcStateUpdateDto,
  ): Promise<VcStateUpdate> {
    return this.engine.exec(async (c: Client) => {
      update.priceWei = update.priceWei || new BigNumber(0)
      update.priceToken = update.priceToken || new BigNumber(0)

      const res = await c.query(
        `INSERT INTO virtual_channel_state_updates(
          channel_id,
          nonce,
          wei_balance_a,
          wei_balance_b,
          erc20_balance_a,
          erc20_balance_b,
          price_wei,
          price_erc20,                                         
          sig_a,
          sig_b,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          channelId,
          update.nonce,
          update.ethBalanceA.toString(),
          update.ethBalanceB.toString(),
          update.tokenBalanceA.toString(),
          update.tokenBalanceB.toString(),
          update.priceWei.toString(),
          update.priceToken.toString(),
          update.sigA,
          update.sigB,
          Date.now()
        ],
      )
      const row = res.rows[0]

      return this.inflateRowStateUpdate(row)
    })
  }

  public async cosignUpdate(
    channelId: string,
    nonce: number,
    sig: string,
  ): Promise<VcStateUpdate> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `UPDATE virtual_channel_state_updates SET sig_b = $3 WHERE channel_id = $1 AND nonce = $2 RETURNING *`,
        [channelId, nonce, sig],
      )
      const row = res.rows[0]

      return this.inflateRowStateUpdate(row)
    })
  }

  public async getUpdate(
    channelId: string,
    nonce: number,
  ): Promise<VcStateUpdate | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM virtual_channel_state_updates WHERE channel_id = $1 AND nonce = $2 LIMIT 1`,
        [channelId, nonce],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  getUpdateById(id: number): Promise<VcStateUpdate | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM virtual_channel_state_updates WHERE id = $1 LIMIT 1`,
        [id],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  public async getLatestUpdate(
    channelId: string,
  ): Promise<VcStateUpdate | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM virtual_channel_state_updates WHERE channel_id = $1 ORDER BY nonce DESC LIMIT 1`,
        [channelId],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  // assume single signed update can close
  public async getLatestSignedUpdate(
    channelId: string,
  ): Promise<VcStateUpdate | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM virtual_channel_state_updates 
        WHERE channel_id = $1 
        AND virtual_channel_state_updates.sig_a is NOT NULL
        ORDER BY nonce DESC LIMIT 1`,
        [channelId],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  private inflateRow(row: any): VirtualChannel {
    return {
      state: row.status,
      ethBalanceA: new BigNumber(row.wei_balance_a),
      ethBalanceB: new BigNumber(row.wei_balance_b),
      tokenBalanceA: new BigNumber(row.erc20_balance_a),
      tokenBalanceB: new BigNumber(row.erc20_balance_b),
      channelId: row.channel_id,
      partyA: row.party_a,
      partyB: row.party_b,
      partyI: row.party_i,
      subchanAtoI: row.subchan_a_to_i,
      subchanBtoI: row.subchan_b_to_i,
      nonce: parseInt(row.nonce, 10),
      onChainNonce: parseInt(row.on_chain_nonce, 10),
      updateTimeout: parseInt(row.update_timeout),
    }
  }

  private inflateRowStateUpdate(row: any): VcStateUpdate {
    return {
      id: parseInt(row.id),
      channelId: row.channel_id,
      ethBalanceA: new BigNumber(row.wei_balance_a),
      ethBalanceB: new BigNumber(row.wei_balance_b),
      tokenBalanceA: new BigNumber(row.erc20_balance_a),
      tokenBalanceB: new BigNumber(row.erc20_balance_b),
      priceWei: new BigNumber(row.price_wei || 0),
      priceToken: new BigNumber(row.price_erc20 || 0),
      nonce: parseInt(row.nonce, 10),
      sigA: row.sig_a,
      sigB: row.sig_b,
      createdAt: Number(row.created_at)
    }
  }
}
