import ChainsawPollEvent from '../domain/ChainsawPollEvent'
import { Client } from 'pg'
import DBEngine from '../DBEngine'
import ChannelEvent from '../domain/ChannelEvent'
import {
  LedgerChannel,
  ChainsawLedgerChannel,
  ChainsawDeposit,
} from '../domain/LedgerChannel'
import { BigNumber } from 'bignumber.js'

export enum LcStatus {
  Opening = 'LCS_OPENING',
  Opened = 'LCS_OPENED',
  Settling = 'LCS_SETTLING',
  Settled = 'LCS_SETTLED',
}

export default interface ChainsawLcDao {
  lastPollFor(address: string): Promise<ChainsawPollEvent>

  recordPoll(toBlock: number, contract: string): Promise<void>

  recordEvents(
    events: ChannelEvent[],
    toBlock: number,
    contract: string,
  ): Promise<void>

  correlateDeposit(depositId: number, updateId: number): Promise<any>

  ledgerChannelById(channelId: string): Promise<LedgerChannel | null>

  ledgerChannelsByAddresses(
    partyA: string,
    partyI: string,
    status: string,
  ): Promise<LedgerChannel[]>

  ledgerChannelsByAddress(
    address: string,
    status: string,
  ): Promise<LedgerChannel[]>

  ledgerChannelContractAddressById(channelId: string): Promise<string | null>
  ledgerChannelDepositsByChannelId(
    channelId: string,
  ): Promise<ChainsawDeposit[]>
  ledgerChannelUncorrelatedDepositsByChannelId(
    channelId: string,
  ): Promise<ChainsawDeposit[]>
  ledgerChannelDepositById(depositId: number): Promise<ChainsawDeposit | null>
  ledgerChannels(): Promise<LedgerChannel[]>
}

export class PostgresChainsawLcDao implements ChainsawLcDao {
  private engine: DBEngine<Client>

  constructor(engine: DBEngine<Client>) {
    this.engine = engine
  }

  lastPollFor(contract: string): Promise<ChainsawPollEvent> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM chainsaw_poll_events WHERE contract = $1 ORDER BY block_number DESC LIMIT 1',
        [contract],
      )

      if (!res.rows.length) {
        return {
          blockNumber: 0,
          polledAt: 0,
          contract,
        } as any
      }

      return this.inflateRow(res.rows[0]) as any
    })
  }

  recordPoll(toBlock: number, contract: string): Promise<void> {
    return this.engine.exec(async (c: Client) => {
      await c.query(
        'INSERT INTO chainsaw_poll_events (block_number, polled_at, contract) VALUES ($1, $2, $3)',
        [toBlock, Date.now(), contract],
      )
    })
  }

  recordEvents(
    events: ChannelEvent[],
    toBlock: number,
    contract: string,
  ): Promise<void> {
    return this.engine.exec(async (c: Client) => {
      await c.query('BEGIN')

      try {
        await Promise.all(
          events.map((e: ChannelEvent) => {
            const fields = e.contractEvent.toFields()

            return c.query(
              'INSERT INTO chainsaw_channel_events (contract, channel_id, ts, block_number, block_hash, is_valid_block, sender, event_type, fields) VALUES ' +
                '($1, $2, $3, $4, $5, $6, $7, $8, $9)',
              [
                e.contract,
                e.contractEvent,
                e.ts,
                e.contractEvent.blockNumber,
                e.contractEvent.blockHash,
                true,
                e.sender,
                e.contractEvent.TYPE,
                fields ? JSON.stringify(fields) : null,
              ],
            )
          }),
        )

        await c.query(
          'INSERT INTO chainsaw_poll_events (block_number, polled_at, contract) VALUES ($1, $2, $3)',
          [toBlock, Date.now(), contract],
        )
      } catch (e) {
        await c.query('ROLLBACK')
        throw e
      }

      await c.query('COMMIT')
    })
  }

  correlateDeposit(depositId: number, updateId: number): Promise<any> {
    return this.engine.exec(async (c: Client) => {
      await c.query(
        `UPDATE chainsaw_ledger_channels_deposits
          SET ledger_channel_state_updates_id = $1 WHERE deposit_event_id = $2 RETURNING *`,
        [updateId, depositId],
      )
    })
  }

  ledgerChannelById(channelId: string): Promise<LedgerChannel | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * from hub_ledger_channels WHERE channel_id = $1 LIMIT 1',
        [channelId],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateLcRow(row)
    })
  }

  ledgerChannelsByAddresses(
    partyA: string,
    partyI: string,
    status: string,
  ): Promise<LedgerChannel[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM hub_ledger_channels WHERE party_a = $1 AND party_i = $2 AND status = $3`,
        [partyA, partyI, status],
      )

      if (!res.rows.length) {
        return []
      }

      return res.rows.map(row => {
        return this.inflateLcRow(row)
      })
    })
  }

  ledgerChannelsByAddress(
    address: string,
    status: string,
  ): Promise<LedgerChannel[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM hub_ledger_channels WHERE party_a = $1 OR party_i = $1 AND status = $2`,
        [address, status],
      )

      if (!res.rows.length) {
        return []
      }

      return res.rows.map(row => {
        return this.inflateLcRow(row)
      })
    })
  }

  ledgerChannelContractAddressById(channelId: string): Promise<string | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM hub_ledger_channels WHERE channel_id = $1 LIMIT 1',
        [channelId],
      )

      if (!res.rows.length) {
        return null
      }

      const row = await this.inflateChainsawLcRow(res.rows[0])
      return row.contract
    })
  }

  ledgerChannels(): Promise<LedgerChannel[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(`SELECT * FROM hub_ledger_channels`)

      if (!res.rows.length) {
        return []
      }

      return res.rows.map(row => {
        return this.inflateLcRow(row)
      })
    })
  }

  ledgerChannelDepositsByChannelId(
    channelId: string,
  ): Promise<ChainsawDeposit[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM chainsaw_ledger_channels_deposits
          JOIN chainsaw_channel_events
          ON chainsaw_channel_events.id = chainsaw_ledger_channels_deposits.deposit_event_id
        WHERE chainsaw_ledger_channels_deposits.channel_id = $1`,
        [channelId],
      )

      if (!res.rows.length) {
        return []
      }

      return res.rows.map(row => this.inflateDepositRow(row))
    })
  }

  ledgerChannelDepositById(depositId: number): Promise<ChainsawDeposit | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM chainsaw_ledger_channels_deposits
          JOIN chainsaw_channel_events
          ON chainsaw_channel_events.id = chainsaw_ledger_channels_deposits.deposit_event_id
        WHERE chainsaw_ledger_channels_deposits.deposit_event_id = $1`,
        [depositId],
      )

      if (!res.rows.length) {
        return null
      }

      const row = res.rows[0]
      return this.inflateDepositRow(row)
    })
  }

  ledgerChannelUncorrelatedDepositsByChannelId(
    channelId: string,
  ): Promise<ChainsawDeposit[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM chainsaw_ledger_channels_deposits
          JOIN chainsaw_channel_events
          ON chainsaw_channel_events.id = chainsaw_ledger_channels_deposits.deposit_event_id
        WHERE
          chainsaw_ledger_channels_deposits.channel_id = $1
          AND chainsaw_ledger_channels_deposits.ledger_channel_state_updates_id IS NULL`,
        [channelId],
      )

      if (!res.rows.length) {
        return []
      }

      return res.rows.map(row => this.inflateDepositRow(row))
    })
  }

  private inflateLcRow(row: any): LedgerChannel {
    return {
      state: row.status,
      ethBalanceA: new BigNumber(row.wei_balance_a),
      ethBalanceI: new BigNumber(row.wei_balance_i),
      tokenBalanceA: new BigNumber(row.erc20_balance_a),
      tokenBalanceI: new BigNumber(row.erc20_balance_i),
      channelId: row.channel_id,
      partyA: row.party_a,
      partyI: row.party_i,
      token: row.token,
      nonce: parseInt(row.nonce),
      openVcs: parseInt(row.open_vcs),
      vcRootHash: row.vc_root_hash,
      openTimeout: parseInt(row.open_timeout),
      updateTimeout: parseInt(row.update_timeout),
    }
  }

  private inflateChainsawLcRow(row: any): ChainsawLedgerChannel {
    return {
      state: row.status,
      ethBalanceA: new BigNumber(row.wei_balance_a),
      ethBalanceI: new BigNumber(row.wei_balance_i),
      tokenBalanceA: new BigNumber(row.erc20_balance_a),
      tokenBalanceI: new BigNumber(row.erc20_balance_i),
      channelId: row.channel_id,
      partyA: row.party_a,
      partyI: row.party_i,
      token: row.token,
      nonce: parseInt(row.nonce),
      openVcs: parseInt(row.open_vcs),
      vcRootHash: row.vc_root_hash,
      openTimeout: parseInt(row.open_timeout),
      updateTimeout: parseInt(row.update_timeout),
      contract: row.contract,
    }
  }

  private inflateDepositRow(row: any): ChainsawDeposit {
    return {
      depositId: row.deposit_event_id,
      deposit: new BigNumber(row.fields.deposit),
      isToken: row.fields.isToken,
      recipient: row.fields.recipient,
      updateId: row.ledger_channel_state_updates_id,
    }
  }

  private inflateRow(row: any): ChainsawPollEvent {
    return {
      blockNumber: Number(row.block_number),
      polledAt: Number(row.polled_at),
      contract: row.contract,
    } as any
  }
}
