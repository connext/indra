import DBEngine, { SQL } from '../DBEngine'
import { Client } from 'pg'
import {
  ChannelUpdateReason,
  ChannelState,
  ArgsTypes,
  ChannelStateBigNumber,
  PaymentArgsBigNumber,
  ExchangeArgsBigNumber,
  DepositArgsBigNumber,
  WithdrawalArgsBigNumber,
  convertArgs,
} from '../vendor/connext/types'
import { BigNumber } from 'bignumber.js'
import Config from '../Config'
import {
  ChannelStateUpdateRowBigNum,
  ChannelRowBigNum,
} from '../domain/Channel'
import { Big } from '../util/bigNumber'
import { emptyRootHash } from '../vendor/connext/Utils'
import { default as log } from '../util/log'

export default interface ChannelsDao {
  getChannelByUser(user: string): Promise<ChannelRowBigNum | null>
  getChannelOrInitialState(user: string): Promise<ChannelRowBigNum>
  getChannelUpdatesForSync(
    user: string,
    txCount: number,
  ): Promise<ChannelStateUpdateRowBigNum[]>
  getChannelUpdateByTxCount(
    user: string,
    txCount: number,
  ): Promise<ChannelStateUpdateRowBigNum | null>
  getLatestChannelUpdateDoubleSigned(
    user: string,
  ): Promise<ChannelStateUpdateRowBigNum | null>
  getLatestChannelUpdateHubSigned(
    user: string,
  ): Promise<ChannelStateUpdateRowBigNum | null>
  applyUpdateByUser(
    user: string,
    reason: ChannelUpdateReason,
    originator: string,
    state: ChannelState,
    args: ArgsTypes,
    chainsawEventId?: number,
    onchainLogicalId?: number,
  ): Promise<ChannelStateUpdateRowBigNum>
  getTotalTokensInReceiverThreads(user: string): Promise<BigNumber>
  getTotalChannelTokensPlusThreadBonds(user: string): Promise<BigNumber>
  getRecentTippers(user: string): Promise<number>
}

export function getChannelInitialState(
  user: string,
  contractAddress: string,
): ChannelStateBigNumber {
  return {
    contractAddress,
    user,
    recipient: user,
    balanceWeiHub: Big(0),
    balanceWeiUser: Big(0),
    balanceTokenHub: Big(0),
    balanceTokenUser: Big(0),
    pendingDepositWeiHub: Big(0),
    pendingDepositWeiUser: Big(0),
    pendingDepositTokenHub: Big(0),
    pendingDepositTokenUser: Big(0),
    pendingWithdrawalWeiHub: Big(0),
    pendingWithdrawalWeiUser: Big(0),
    pendingWithdrawalTokenHub: Big(0),
    pendingWithdrawalTokenUser: Big(0),
    threadCount: 0,
    threadRoot: emptyRootHash,
    timeout: 0,
    txCountChain: 0,
    txCountGlobal: 0,
    sigHub: null,
    sigUser: null,
  }
}

const LOG = log('ChannelsDao')

export class PostgresChannelsDao implements ChannelsDao {
  private db: DBEngine<Client>

  private config: Config

  constructor(db: DBEngine<Client>, config: Config) {
    this.db = db
    this.config = config
  }

  // gets latest state of channel
  async getChannelByUser(user: string): Promise<ChannelRowBigNum | null> {
    return this.inflateChannelRow(
      await this.db.queryOne(SQL`
        SELECT * FROM cm_channels
        WHERE
          "user" = ${user.toLowerCase()} AND
          contract = ${this.config.channelManagerAddress.toLowerCase()}
      `),
    )
  }

  async getChannelOrInitialState(user: string): Promise<ChannelRowBigNum> {
    let row = await this.getChannelByUser(user)
    if (!row) {
      row = {
        id: null,
        status: 'CS_OPEN',
        state: getChannelInitialState(user, this.config.channelManagerAddress),
      }
    }
    return row
  }

  async getChannelUpdatesForSync(
    user: string,
    txCount: number,
  ): Promise<ChannelStateUpdateRowBigNum[]> {
    const { rows } = await this.db.query(SQL`
        SELECT * FROM cm_channel_updates 
        WHERE 
          "user" = ${user} AND
          contract = ${this.config.channelManagerAddress} AND
          tx_count_global >= ${txCount} AND
          invalid IS NULL
        ORDER BY tx_count_global ASC
      `)

    return rows.map(r => this.inflateChannelUpdateRow(r))
  }

  async getLatestChannelUpdateDoubleSigned(
    user: string,
  ): Promise<ChannelStateUpdateRowBigNum | null> {
    return this.inflateChannelUpdateRow(
      await this.db.queryOne(SQL`
        SELECT * FROM cm_channel_updates 
        WHERE 
          "user" = ${user.toLowerCase()} AND
          contract = ${this.config.channelManagerAddress.toLowerCase()} AND
          sig_user IS NOT NULL AND
          sig_hub IS NOT NULL AND
          invalid IS NULL
        ORDER BY tx_count_global DESC
        LIMIT 1
      `),
    )
  }

  async getLatestChannelUpdateHubSigned(
    user: string,
  ): Promise<ChannelStateUpdateRowBigNum | null> {
    return this.inflateChannelUpdateRow(
      await this.db.queryOne(SQL`
        SELECT * FROM cm_channel_updates 
        WHERE 
          "user" = ${user.toLowerCase()} AND
          contract = ${this.config.channelManagerAddress.toLowerCase()} AND
          sig_hub IS NOT NULL AND
          invalid IS NULL
        ORDER BY tx_count_global DESC
        LIMIT 1
      `),
    )
  }

  async getChannelUpdateByTxCount(
    user: string,
    txCountGlobal: number,
  ): Promise<ChannelStateUpdateRowBigNum | null> {
    return this.inflateChannelUpdateRow(
      await this.db.queryOne(SQL`
        SELECT u.*, c.user, c.contract FROM cm_channel_updates u
        join cm_channels c on c.id = u.channel_id
        WHERE 
        c."user" = ${user.toLowerCase()} AND
        c.contract = ${this.config.channelManagerAddress.toLowerCase()} and 
        u.tx_count_global = ${txCountGlobal} AND
        u.invalid IS NULL
        ORDER BY u.tx_count_global ASC
      `),
    )
  }

  async applyUpdateByUser(
    user: string,
    reason: ChannelUpdateReason,
    originator: string,
    state: ChannelState,
    args: ArgsTypes,
    chainsawEventId?: number,
    onchainLogicalId?: number,
  ): Promise<ChannelStateUpdateRowBigNum> {

    LOG.info('Applying channel update to {user}: {reason}({args}) -> {state}', {
      user,
      reason,
      args: JSON.stringify(args),
      state: JSON.stringify(state),
    })

    return this.inflateChannelUpdateRow(
      await this.db.queryOne(SQL`
        SELECT *
        FROM cm_channel_insert_or_update_state(
          _hub := ${this.config.hotWalletAddress},
          _contract := ${this.config.channelManagerAddress},
          _user := ${user},
          reason := ${reason},
          args := ${args},
          originator := ${originator.toLowerCase()},
          _chainsaw_event_id := ${chainsawEventId || null},
          _onchain_tx_logical_id := ${onchainLogicalId || null},
          update_obj := ${state}
        )
      `),
    )
  }

  async getTotalChannelTokensPlusThreadBonds(user: string): Promise<BigNumber> {
    const { result } = await this.db.queryOne(SQL`
      SELECT (
        COALESCE((
        SELECT SUM(balance_token_sender)
          FROM cm_thread_updates 
          WHERE
            sender = ${user} AND
            contract = ${this.config.channelManagerAddress} AND
            status = 'CT_OPEN' AND
            tx_count = 0
        ), 0) + 
        COALESCE((
          SELECT balance_token_user
            FROM cm_channels
            WHERE
              "user" = ${user} AND
              contract = ${this.config.channelManagerAddress}
        ), 0)
      ) AS result
    `)
    return Big(result)
  }

  // gets the amount of tokens in all open threads where user is receiver
  async getTotalTokensInReceiverThreads(user: string): Promise<BigNumber> {
    const { co_amount } = await this.db.queryOne(SQL`
      SELECT
        COALESCE(
          SUM(balance_token_sender + balance_token_receiver), 0
        ) AS co_amount
        FROM cm_threads
        WHERE
            contract = ${this.config.channelManagerAddress} AND
            receiver = ${user} AND
            status = 'CT_OPEN'
    `)

    return Big(co_amount)
  }

  async getRecentTippers(user: string): Promise<number> {
    const { num_tippers } = await this.db.queryOne(SQL`
      SELECT COUNT(DISTINCT sender) AS num_tippers
      FROM payments
        WHERE
          recipient = ${user} AND
          created_on > NOW() - interval '10 minutes'
    `)

    return parseInt(num_tippers)
  }

  private inflateChannelStateRow(row: any): ChannelStateBigNumber {
    return (
      row && {
        user: row.user,
        recipient: row.recipient,
        txCountChain: row.tx_count_chain,
        txCountGlobal: row.tx_count_global,
        balanceWeiHub: new BigNumber(row.balance_wei_hub),
        balanceWeiUser: new BigNumber(row.balance_wei_user),
        balanceTokenHub: new BigNumber(row.balance_token_hub),
        balanceTokenUser: new BigNumber(row.balance_token_user),
        pendingDepositWeiHub: new BigNumber(row.pending_deposit_wei_hub || 0),
        pendingDepositWeiUser: new BigNumber(row.pending_deposit_wei_user || 0),
        pendingDepositTokenHub: new BigNumber(
          row.pending_deposit_token_hub || 0,
        ),
        pendingDepositTokenUser: new BigNumber(
          row.pending_deposit_token_user || 0,
        ),
        pendingWithdrawalWeiHub: new BigNumber(
          row.pending_withdrawal_wei_hub || 0,
        ),
        pendingWithdrawalWeiUser: new BigNumber(
          row.pending_withdrawal_wei_user || 0,
        ),
        pendingWithdrawalTokenHub: new BigNumber(
          row.pending_withdrawal_token_hub || 0,
        ),
        pendingWithdrawalTokenUser: new BigNumber(
          row.pending_withdrawal_token_user || 0,
        ),
        threadCount: row.thread_count,
        threadRoot: row.thread_root,
        sigHub: row.sig_hub,
        sigUser: row.sig_user,
        timeout: row.timeout,
        contractAddress: row.contract,
      }
    )
  }

  private inflateChannelRow(row: any): ChannelRowBigNum {
    return (
      row && {
        state: this.inflateChannelStateRow(row),
        status: row.status,
        id: +row.id,
      }
    )
  }

  private inflateChannelUpdateRow(row: any): ChannelStateUpdateRowBigNum {
    return (
      row && {
        id: +row.id,
        state: this.inflateChannelStateRow(row),
        reason: row.reason,
        channelId: Number(row.channel_id),
        chainsawId: Number(row.chainsaw_event_id),
        createdOn: row.created_on,
        args: convertArgs('bignumber', row.reason, row.args),
      }
    )
  }
}
