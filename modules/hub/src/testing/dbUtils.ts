import * as Connext from '../Connext';
import DBEngine, { SQL } from '../DBEngine'
import { Client } from 'pg'

type UnsignedChannelState = Connext.types.UnsignedChannelState

export async function insertChannel(
  db: DBEngine<Client>,
  hub: string,
  channel: UnsignedChannelState,
): Promise<any> {
  return db.queryOne(
    SQL`
    INSERT INTO _cm_channels (
      contract,
      hub,
      "user",
      recipient,
      status,
      balance_wei_hub,
      balance_wei_user,
      balance_token_user,
      balance_token_hub,
      pending_deposit_wei_hub,
      pending_deposit_wei_user,
      pending_deposit_token_hub,
      pending_deposit_token_user,
      pending_withdrawal_wei_hub,
      pending_withdrawal_wei_user,
      pending_withdrawal_token_hub,
      pending_withdrawal_token_user,
      tx_count_global,
      tx_count_chain,
      thread_root,
      thread_count
    ) VALUES (
      ${channel.contractAddress},
      ${hub},
      ${channel.user},
      ${channel.recipient},
      'CS_OPEN',
      ${channel.balanceWeiHub},
      ${channel.balanceWeiUser},
      ${channel.balanceTokenHub},
      ${channel.balanceTokenUser},
      ${channel.pendingDepositWeiHub},
      ${channel.pendingDepositWeiUser},
      ${channel.pendingDepositTokenHub},
      ${channel.pendingDepositTokenUser},
      ${channel.pendingWithdrawalWeiHub},
      ${channel.pendingWithdrawalWeiUser},
      ${channel.pendingWithdrawalTokenHub},
      ${channel.pendingWithdrawalTokenUser},
      ${channel.txCountGlobal},
      ${channel.txCountChain},
      ${channel.threadRoot},
      ${channel.threadCount}
    ) RETURNING *;`,
  )
}
