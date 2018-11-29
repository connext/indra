import DBEngine from '../DBEngine'
import { Client } from 'pg'
import { BigNumber } from 'bignumber.js'
import { LcStateUpdateDto, LcStateUpdate } from '../domain/LedgerChannel'
import GenericDao, { PostgresGenericDao } from './GenericDao'

export enum UpdateReason {
  VcOpened = 'VC_OPENED',
  VcClosed = 'VC_CLOSED',
  LcDeposit = 'LC_DEPOSIT',
  LcFastClose = 'LC_FAST_CLOSE',
  LcPayment = 'LC_PAYMENT',
}

export default interface LedgerChannelsDao extends GenericDao {
  createStateUpdate(
    channelId: string,
    stateUpdate: LcStateUpdateDto,
  ): Promise<LcStateUpdate>
  addSigAToUpdate(
    channelId: string,
    nonce: number,
    sig: string,
  ): Promise<LcStateUpdate>
  getStateUpdate(
    channelId: string,
    nonce: number,
  ): Promise<LcStateUpdate | null>
  getStateUpdateById(id: number): Promise<LcStateUpdate | null>
  getLatestStateUpdate(
    channelId: string,
    sigA: boolean,
    sigI: boolean,
  ): Promise<LcStateUpdate | null>
  getStateUpdates(channelId: string): Promise<LcStateUpdate[]>
}

export class PostgresLedgerChannelsDao extends PostgresGenericDao
  implements LedgerChannelsDao {
  constructor(client: DBEngine<Client>) {
    super(client)
  }

  public async createStateUpdate(
    channelId: string,
    stateUpdate: LcStateUpdateDto,
  ): Promise<LcStateUpdate> {
    return this.engine.exec(async (c: Client) => {
      stateUpdate.priceWei = stateUpdate.priceWei || new BigNumber(0)
      stateUpdate.priceToken = stateUpdate.priceToken || new BigNumber(0)

      const res = await c.query(
        `INSERT INTO ledger_channel_state_updates(
          is_close,
          channel_id,
          nonce,
          open_vcs,
          vc_root_hash,
          wei_balance_a,
          wei_balance_i,
          erc20_balance_a,
          erc20_balance_i,
          sig_a,
          sig_i,
          reason,
          vc_id,
          price_wei,
          price_erc20,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
        [
          stateUpdate.isClose ? 1 : 0,
          channelId,
          stateUpdate.nonce,
          stateUpdate.openVcs,
          stateUpdate.vcRootHash,
          stateUpdate.ethBalanceA.toString(),
          stateUpdate.ethBalanceI.toString(),
          stateUpdate.tokenBalanceA.toString(),
          stateUpdate.tokenBalanceI.toString(),
          stateUpdate.sigA,
          stateUpdate.sigI,
          stateUpdate.reason,
          stateUpdate.vcId,
          stateUpdate.priceWei.toString(),
          stateUpdate.priceToken.toString(),
          Date.now()
        ],
      )

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  public async addSigAToUpdate(
    channelId: string,
    nonce: number,
    sig: string,
  ): Promise<LcStateUpdate> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `UPDATE ledger_channel_state_updates SET sig_a = $3 WHERE channel_id = $1 AND nonce = $2 RETURNING *`,
        [channelId, nonce, sig],
      )

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  public async getLatestStateUpdate(
    channelId: string,
    sigA: boolean,
    sigI: boolean,
  ): Promise<LcStateUpdate | null> {
    const sigAQuery = sigA ? `AND sig_a IS NOT NULL` : ``
    const sigIQuery = sigI ? `AND sig_i IS NOT NULL` : ``
    const sigQuery = [sigAQuery, sigIQuery].join(' ')
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM ledger_channel_state_updates WHERE channel_id = $1 ${sigQuery} ORDER BY nonce DESC LIMIT 1`,
        [channelId],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  public async getStateUpdate(
    channelId: string,
    nonce: number,
  ): Promise<LcStateUpdate | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM ledger_channel_state_updates WHERE channel_id = $1 AND nonce = $2 LIMIT 1`,
        [channelId, nonce],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  public async getStateUpdates(channelId: string): Promise<LcStateUpdate[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM ledger_channel_state_updates WHERE channel_id = $1 ORDER BY nonce DESC`,
        [channelId],
      )

      if (!res.rows.length) {
        return []
      }

      return res.rows.map(row => this.inflateRowStateUpdate(row))
    })
  }

  public async getStateUpdateById(id: number): Promise<LcStateUpdate | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM ledger_channel_state_updates WHERE id = $1 LIMIT 1`,
        [id],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateRowStateUpdate(row)
    })
  }

  private inflateRowStateUpdate(row: any): LcStateUpdate {
    return {
      id: parseInt(row.id, 10),
      channelId: row.channel_id,
      ethBalanceA: new BigNumber(row.wei_balance_a),
      ethBalanceI: new BigNumber(row.wei_balance_i),
      tokenBalanceA: new BigNumber(row.erc20_balance_a),
      tokenBalanceI: new BigNumber(row.erc20_balance_i),
      isClose: parseInt(row.is_close) === 1,
      nonce: parseInt(row.nonce, 10),
      openVcs: parseInt(row.open_vcs, 10),
      vcRootHash: row.vc_root_hash,
      sigA: row.sig_a,
      sigI: row.sig_i,
      priceWei: new BigNumber(row.price_wei || 0),
      priceToken: new BigNumber(row.price_erc20 || 0),
      reason: row.reason
    }
  }
}
