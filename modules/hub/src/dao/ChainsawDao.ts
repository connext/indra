import ChainsawPollEvent from '../domain/ChainsawPollEvent'
import { Client } from 'pg'
import DBEngine from '../DBEngine'
import {ContractEvent} from '../domain/ContractEvent'
import Config from '../Config'
import { Logger } from '../util'

export type PollType = 'FETCH_EVENTS' | 'PROCESS_EVENTS' | 'SKIP_EVENTS' | 'RETRY'

export type ContractEventWithMeta = {
  event: ContractEvent,
  id: number
}

export default interface ChainsawDao {
  lastPollFor(address: string, type: PollType): Promise<ChainsawPollEvent>

  lastProcessEventPoll(address: string): Promise<ChainsawPollEvent>

  recordPoll(toBlock: number, txIdx: number|null, contract: string, type: PollType): Promise<void>

  recordEvents(
    events: ContractEvent[],
    toBlock: number,
    contract: string,
  ): Promise<void>

  eventsSince(contract: string, blockNumber: number, txIndex: number|null): Promise<ContractEventWithMeta[]>

  eventAt(contract: string, user: string, txCountGlobal: number, txCountChain: number): Promise<ContractEvent|null>

  eventByHash(txHash: string): Promise<ContractEvent|null>
}

export class PostgresChainsawDao implements ChainsawDao {
  private engine: DBEngine<Client>
  private hubAddress: string
  private log: Logger

  constructor(engine: DBEngine<Client>, config: Config) {
    this.engine = engine
    this.hubAddress = config.hotWalletAddress
    this.log = new Logger('ChainsawDao', config.logLevel)
  }

  lastProcessEventPoll(contract: string): Promise<ChainsawPollEvent> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM chainsaw_poll_events WHERE contract = $1 and poll_type = $2 or poll_type = $3 ORDER BY block_number DESC LIMIT 1',
        [contract.toLowerCase(), 'PROCESS_EVENTS', 'SKIP_EVENTS'],
      )

      if (!res.rows.length) {
        return {
          blockNumber: 0,
          txIndex: null,
          polledAt: 0,
          contract,
        }
      }

      return this.inflateRow(res.rows[0])
    })
  }

  lastPollFor(contract: string, type: PollType): Promise<ChainsawPollEvent> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * FROM chainsaw_poll_events WHERE contract = $1 and poll_type = $2 ORDER BY block_number DESC LIMIT 1',
        [contract.toLowerCase(), type],
      )

      if (!res.rows.length) {
        return {
          blockNumber: 0,
          txIndex: null,
          polledAt: 0,
          contract,
        }
      }

      return this.inflateRow(res.rows[0])
    })
  }

  recordPoll(toBlock: number, txIdx: number|null, contract: string, type: PollType): Promise<void> {
    return this.engine.exec(async (c: Client) => {
      await c.query(
        'INSERT INTO chainsaw_poll_events (block_number, tx_idx, polled_at, contract, poll_type) VALUES ($1, $2, $3, $4, $5)',
        [toBlock, txIdx, Date.now(), contract.toLowerCase(), type],
      )
    })
  }

  recordEvents(
    events: ContractEvent[],
    toBlock: number,
    contract: string,
  ): Promise<void> {
    return this.engine.exec(async (c: Client) => {
      await c.query('BEGIN')

      try {
        await Promise.all(
          events.map((e: ContractEvent) => {
            const fields = e.toFields()

            const args = [
              this.hubAddress,
              e.contract.toLowerCase(),
              e.blockNumber,
              e.blockHash,
              e.txHash,
              e.logIndex,
              e.txIndex,
              e.sender,
              e.timestamp,
              e.TYPE,
              JSON.stringify(fields)
            ]

            this.log.debug(`Inserting chainsaw event: ${JSON.stringify(args, undefined, 2)}`)

            return c.query(
              'SELECT chainsaw_insert_event($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
              args,
            )
          }),
        )

        await c.query(
          'INSERT INTO chainsaw_poll_events (block_number, polled_at, contract) VALUES ($1, $2, $3)',
          [toBlock, Date.now(), contract.toLowerCase()],
        )
      } catch (e) {
        await c.query('ROLLBACK')
        throw e
      }

      await c.query('COMMIT')
    })
  }

  eventsSince (contract: string, blockNumber: number, txIndex: number|null): Promise<ContractEventWithMeta[]> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        'SELECT * from cm_chainsaw_events_since($1, $2, $3)',
        [contract.toLowerCase(), blockNumber, txIndex]
      )

      if (!res.rows.length) {
        return []
      }

      return res.rows.map((r: any) => {
        return {
          event: ContractEvent.fromRow(r),
          id: r.id
        }
      })
    })
  }

  eventAt (contract: string, user: string, txCountGlobal: number, txCountChain: number): Promise<ContractEvent | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM chainsaw_events e WHERE contract = $1 AND fields->>'user' = $2 AND fields->>'txCountGlobal' = $3 and fields->>'txCountChain' = $4`,
        [
          contract.toLowerCase(),
          user.toLowerCase(),
          txCountGlobal,
          txCountChain
        ]
      )

      if (!res.rows.length) {
        return null
      }

      if (res.rows.length > 1) {
        throw new Error('Expected only one row.')
      }

      return ContractEvent.fromRow(res.rows[0])
    });
  }

  eventByHash (txHash: string): Promise<ContractEvent | null> {
    return this.engine.exec(async (c: Client) => {
      const res = await c.query(
        `SELECT * FROM chainsaw_events e WHERE tx_hash = $1`,
        [txHash]
      )

      if (!res.rows.length) {
        return null
      }

      if (res.rows.length > 1) {
        throw new Error('Expected only one row.')
      }

      return ContractEvent.fromRow(res.rows[0])
    })
  }

  private inflateRow(row: any): ChainsawPollEvent {
    return {
      blockNumber: Number(row.block_number),
      polledAt: Number(row.polled_at),
      txIndex: Number(row.tx_idx),
      contract: row.contract,
    }
  }
}
