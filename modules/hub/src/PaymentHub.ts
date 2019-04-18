import { CoinPaymentsDepositPollingService } from './coinpayments/CoinPaymentsDepositPollingService'
import { CloseChannelService } from './CloseChannelService'
import Config from './Config'
import log from './util/log'
import { Container, Context, Registry } from './Container'
import defaultRegistry from './services'
import { ApiService } from './api/ApiService'
import ExchangeRateService from './ExchangeRateService'
import GasEstimateService from './GasEstimateService'
import { ApiServer } from "./ApiServer"
import ChainsawService from './ChainsawService'
import { OnchainTransactionService } from "./OnchainTransactionService";
import ChannelsService from './ChannelsService';
import { default as DBEngine, SQL } from './DBEngine'
import { ChannelManager } from './ChannelManager'
const Web3 = require('web3')
import abi from './abi/ChannelManager'
import { ContractEvent, DidUpdateChannelEvent } from './domain/ContractEvent'
import { channelNumericFields } from './vendor/connext/types'
import * as readline from 'readline'
import { Big } from './util/bigNumber'
import { ABI as mintAndBurnToken } from './abi/MintAndBurnToken'
import { EventLog } from 'web3-core';
import BigNumber from 'bignumber.js';

const LOG = log('PaymentHub')

export default class PaymentHub {
  private web3: any
  private config: Config
  private registry: Registry

  public container: Container

  private exchangeRateService: ExchangeRateService
  private gasEstimateService: GasEstimateService
  private apiServer: ApiServer
  private onchainTransactionService: OnchainTransactionService
  private coinPaymentsDepositPollingService: CoinPaymentsDepositPollingService

  constructor(config: Config) {
    if (!config.ethRpcUrl) {
      throw new Error('ERROR: ETH_RPC_URL not set!')
    }

    const registry = defaultRegistry(config.registry)
    this.registry = registry

    const web3New = new Web3(new Web3.providers.HttpProvider(config.ethRpcUrl))
    registry.bind('Config', () => config)
    registry.bind('Web3', () => web3New)
    this.web3 = web3New

    this.config = config
    this.container = new Container(registry)
    registry.bind('Container', () => this.container)

    this.exchangeRateService = this.container.resolve('ExchangeRateService')
    this.gasEstimateService = this.container.resolve('GasEstimateService')
    this.apiServer = this.container.resolve('ApiServer')
    this.onchainTransactionService = this.container.resolve('OnchainTransactionService')
    this.coinPaymentsDepositPollingService = this.container.resolve('CoinPaymentsDepositPollingService')
  }

  public async start() {
    const services = [
      'exchangeRateService',
      'gasEstimateService',
      'apiServer',
      'onchainTransactionService',
      'coinPaymentsDepositPollingService',
    ]
    for (let service of services) {
      try {
        await (this as any)[service].start()
      } catch (err) {
        LOG.error(`Failed to start ${service}: ${err}`)
        process.exit(1)
      }
    }
    return new Promise(res => {})
  }

  public async startChainsaw() {
    const chainsaw = this.container.resolve<ChainsawService>('ChainsawService')
    const channelCloser = this.container.resolve<CloseChannelService>('CloseChannelService')
    await Promise.race([
      chainsaw.poll(),
      channelCloser.poll(),
    ])
    return new Promise(res => {})
  }

  public async startUnilateralExitChannels(channels: string[]) {
    if (!channels) {
      throw new Error(`Must specify addresses of channels to be closed as args`)
    }
    const closeChannelsService = this.container.resolve<CloseChannelService>('CloseChannelService')
    for (const channel of channels) {
      await closeChannelsService.startUnilateralExit(channel, 'Started exit from command line')
    }
  }

  public async processTx(txHash: string) {
    const chainsaw = this.container.resolve<ChainsawService>('ChainsawService')
    await chainsaw.processSingleTx(txHash, true)
  }

  public async collateralizeChannel(user: string, amount: BigNumber) {
    const context = new Context()
    const channelsService = this.container.resolve<ChannelsService>('ChannelsService', { 'Context': context })
    await channelsService.doCollateralizeIfNecessary(user, amount)
  }

  public async fixBrokenChannels() {
    /*
    with x as (
      select
        (
          select array_agg(reason)
          from (
            select *
            from cm_channel_updates as prev
            where
              prev.channel_id = c.channel_id and
              prev.tx_count_global between c.tx_count_global - 10 and c.tx_count_global - 1
            order by prev.id desc
          ) as x
        ) as prev_states,
        *
      from cm_channel_updates as c
      where
        c.reason = 'ConfirmPending' AND
        c.sig_user is null AND
        chainsaw_event_id > 100
    )
    select *
    from x
    where not (prev_states[1]::text like 'ProposePending%')
    */

    const users = [
      '0x06473213b66986aa852fab475a2c42a1b8d2396f',
      '0x0ead271d20adf03ff97e8e90f26baed98a0957a5',
      '0x2c80c91b02711b67f01b44a18ff32d559ab62514',
      '0x850e44a61fd83956d82673bb6632524bf6146c58',
      '0xb783ba735906a9879a8606b884de9b164479d813',
      '0xbeaee008bad13470f5df051690682301ad4d0978',
      '0xc13a42f0da8f3d4087272976704289c450dac6ec',
      '0xc39833ce53f8d3c1f4ced6a2748b4ecd3dcca3e8',
      '0xf894af906e60c53d2f3f8f8eb131219647fa685c',
      '0xfcac581840cb5423ce4dcf7ba478bdd0a36ad14e',
    ]

    const container = new Container(this.registry, {
      Context: new Context(),
    })
    const db = container.resolve<DBEngine>('DBEngine')
    try {
      await db.withTransaction(async cxn => {
        await cxn.query(`
create or replace function cm_channels_check_update_trigger()
returns trigger language plpgsql as
$pgsql$
begin
    -- Check that the dispute status is reasonable
    if not (
        coalesce(
            NEW.channel_dispute_event_id::text,
            NEW.channel_dispute_ends_on::text,
            NEW.channel_dispute_originator::text,
            NEW.thread_dispute_event_id::text,
            NEW.thread_dispute_ends_on::text,
            NEW.thread_dispute_originator::text
        ) is null or

        (
            NEW.channel_dispute_event_id is not null and
            NEW.channel_dispute_ends_on is not null and
            NEW.channel_dispute_originator is not null
        ) or

        (
            NEW.thread_dispute_event_id is not null and
            NEW.thread_dispute_ends_on is not null and
            NEW.thread_dispute_originator is not null
        )
    ) then
        raise exception 'Channel has invalid channel/thread dispute status: %', NEW;
    end if;
    return NEW;

end;
$pgsql$;
`)
        for (let user of users)
          await this.fixChannel(container, db, user)


        await cxn.query(`
create or replace function cm_channels_check_update_trigger()
returns trigger language plpgsql as
$pgsql$
begin
    -- Check that the dispute status is reasonable
    if not (
        coalesce(
            NEW.channel_dispute_event_id::text,
            NEW.channel_dispute_ends_on::text,
            NEW.channel_dispute_originator::text,
            NEW.thread_dispute_event_id::text,
            NEW.thread_dispute_ends_on::text,
            NEW.thread_dispute_originator::text
        ) is null or

        (
            NEW.channel_dispute_event_id is not null and
            NEW.channel_dispute_ends_on is not null and
            NEW.channel_dispute_originator is not null
        ) or

        (
            NEW.thread_dispute_event_id is not null and
            NEW.thread_dispute_ends_on is not null and
            NEW.thread_dispute_originator is not null
        )
    ) then
        raise exception 'Channel has invalid channel/thread dispute status: %', NEW;
    end if;

    /*
    TODO: these don't handle deposits.
    Add them to checks on insert to _cm_channel_updates

    -- Check that total balance is preserved if we aren't opening a thread
    if (
        OLD.thread_count = NEW.thread_count AND
        (OLD.balance_wei_hub + OLD.balance_wei_user <> NEW.balance_wei_hub + NEW.balance_wei_user)
    ) then
        raise exception 'Update changes total channel wei balance (old: [%, %], new: [%, %])',
            OLD.balance_wei_hub / 1e18,
            OLD.balance_wei_user / 1e18,
            NEW.balance_wei_hub / 1e18,
            NEW.balance_wei_user / 1e18;
    end if;

    if (
        OLD.thread_count = NEW.thread_count AND
        (OLD.balance_token_hub + OLD.balance_token_user <> NEW.balance_token_hub + NEW.balance_token_user)
    ) then
        raise exception 'Update changes total channel token balance (old: [%, %], new: [%, %])',
            OLD.balance_token_hub / 1e18,
            OLD.balance_token_user / 1e18,
            NEW.balance_token_hub / 1e18,
            NEW.balance_token_user / 1e18;
    end if;
    */

    -- TODO: Check if OLD.thread_count = NEW.thread_count + 1
    -- OLD.balance_wei_hub + OLD.balance_wei_user == NEW.balance_wei_hub + NEW.balance_wei_user - (NEW.thread_balance_sender + NEW.thread_balance_receiver)

    -- TODO: Check if OLD.thread_count = NEW.thread_count - 1
    -- OLD.balance_wei_hub + OLD.balance_wei_user == NEW.balance_wei_hub + NEW.balance_wei_user + NEW.thread_balance_sender + NEW.thread_balance_receiver

    -- Check that the tx count increases monotonically
    if (
        NEW.tx_count_global < OLD.tx_count_global
        -- do not check tx_count_chain since invalidation updates can potentially lower it
    ) then
        raise exception 'Update lowers channel tx_count (old: [%, %], new: [%, %])',
            OLD.tx_count_global,
            OLD.tx_count_chain,
            NEW.tx_count_global,
            NEW.tx_count_chain;
    end if;

    -- TODO: Probably more checks
    return NEW;

end;
$pgsql$;
`)
        throw new Error('ROLLBACK')
      })
    } catch (e) {
      LOG.error(e)
      process.exit(1)
    } finally {
      process.exit(0)
    }
  }

  async fixChannel(container: Container, db: DBEngine, user: string) {
    LOG.info(`\n\nProcessing: ${user}`)
    const config = container.resolve<Config>('Config')
    const web3 = container.resolve<any>('Web3')
    const contract = new web3.eth.Contract(abi, config.channelManagerAddress) as ChannelManager
    const confirmPendings = await db.query(SQL`
      select *
      from cm_channel_updates
      where
        "user" = ${user} and
        reason = 'ConfirmPending' AND
	      sig_user is null
      order by id desc
    `)
    if (confirmPendings.rowCount > 1) {
      LOG.info(`SKIPPING (found ${confirmPendings.rowCount} unsigned confirms)`)
      return
    }

    // 1. Find the ConfirmPending event
    const confirmPending = confirmPendings.rows[0]
    LOG.info(`Confirmation: ${confirmPending}`)

    // 2. Grab the corresponding onchain tx
    const tx = await web3.eth.getTransaction(confirmPending.args.transactionHash)
    LOG.debug(`tx: ${tx}`)
    const rawEvents = await contract.getPastEvents('allEvents', {
      fromBlock: tx.blockNumber,
      toBlock: tx.blockNumber,
    })
    const events: ContractEvent[] = rawEvents.map((log: EventLog) => {
      return ContractEvent.fromRawEvent({
        log: log,
        txIndex: log.transactionIndex,
        logIndex: log.logIndex,
        contract: config.channelManagerAddress,
        sender: '0xsender',
        timestamp: 0,
      })
    })

    if (events.length > 1)
      throw new Error('uh oh, more events than we expected: ' + JSON.stringify(events))

    // 3. Find the DidUpdateChannelEvent emitted by the transaction
    const event = events[0] as DidUpdateChannelEvent
    if (
      event.TYPE != 'DidUpdateChannel' ||
      event.user.toLowerCase() != user
    ) {
      throw new Error('Uh oh, bad event: ' + JSON.stringify(event))
    }
    for (const field of channelNumericFields)
      event[field] = event[field].toFixed()
      LOG.debug(`event: ${event}`)

    // 4. Find the correponding fully-signed ProposePending
    const pps = await db.query(SQL`
      select *
      from cm_channel_updates
      where
        "user" = ${user} and
        reason::text like 'ProposePending%' and
        sig_user is not null
      order by id desc
    `)

    const pp = pps.rows[0]
    LOG.debug(`PP: ${pp}`)

    const doesMatch = (
      pp.pending_deposit_wei_hub == event.pendingDepositWeiHub &&
      pp.pending_deposit_wei_user == event.pendingDepositWeiUser &&
      pp.pending_deposit_token_hub == event.pendingDepositTokenHub &&
      pp.pending_deposit_token_user == event.pendingDepositTokenUser &&
      pp.pending_withdrawal_wei_hub == event.pendingWithdrawalWeiHub &&
      pp.pending_withdrawal_wei_user == event.pendingWithdrawalWeiUser &&
      pp.pending_withdrawal_token_hub == event.pendingWithdrawalTokenHub &&
      pp.pending_withdrawal_token_user == event.pendingWithdrawalTokenUser &&
      pp.tx_count_chain == event.txCountChain
    )
    if (!doesMatch)
      throw new Error('UH OH NO MATCH')

    // 4. Figure out how much was paid to the user (since these are going to be
    //    deleted)
    const amountDue = await db.queryOne(SQL`
      select sum((args->>'amountToken')::numeric) / 1e18 as amount
      from cm_channel_updates
      where
        "user" = ${user} and
        id > ${pp.id} and
        reason = 'Payment' and
        args->>'recipient' = 'user'
    `)
    LOG.info(`Payments due: ${amountDue}`)

    // 5. Mark the ProposePending as valid, then delete all subsequent states
    await db.query(SQL`
      update _cm_channel_updates
      set invalid = null
      where id = ${pp.id}
    `)
    await db.query(SQL`
      update _cm_channels
      set latest_update_id = ${pp.id}
      where id = ${pp.channel_id}
    `)
    const toDelete = (q: any) => SQL`
      with to_delete as (
        select *
        from cm_channel_updates
        where
          "user" = ${user} and
          id > ${pp.id}
      )
    `.append(q)

    await db.query(toDelete(SQL`
      delete from custodial_payments
      where disbursement_id in (select id from to_delete)
    `))
    await db.query(toDelete(SQL`
      update _cm_channel_updates
      set invalid = 'CU_INVALID_ERROR'
      where id in (select id from to_delete)
    `))
    const deleted = await db.query(toDelete(SQL`
      delete from _cm_channel_updates
      where id in (select id from to_delete)
      returning *
    `))
    LOG.info(`Removed invalid upates: ${deleted.rowCount}`)

    // 6. Re-proc the chainsaw transaction
    const definition = this.registry.get('ChainsawService')
    definition.isSingleton = false
    const chainsaw = container.resolve<ChainsawService>('ChainsawService')
    await chainsaw.processSingleTx(confirmPending.args.transactionHash)

  }

  async hubBurnBooty(amount: number) {
    if (amount <= 0)
      throw new Error('Aborting: invalid amount of BOOTY: ' + amount)

    function input(msg: string): Promise<string> {
      process.stdout.write(msg)
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      })
      return new Promise(res => rl.on('line', res))
    }

    const callArgs = { from: this.config.hotWalletAddress }
    const tokenContract = new this.web3.eth.Contract(mintAndBurnToken.abi, this.config.tokenContractAddress)
    const hubBalanceStr = await tokenContract.methods.balanceOf(this.config.hotWalletAddress).call(callArgs)
    const hubBalance = Big(hubBalanceStr).dividedBy('1e18')
    LOG.info(
      `Current BOOTY (${this.config.tokenContractAddress}) balance of hub ` +
      `(${this.config.hotWalletAddress}): ${hubBalance.toFixed()}`
    )

    const toWd = Big(amount).minus(hubBalance)
    if (toWd.isGreaterThan(0)) {
      LOG.info(`Need to hubContractWithdraw ${toWd.toFixed()} BOOTY.`)
      const amountConfirm = await input(`Please confirm the amount of BOOTY to hubContractWithdraw (${toWd.toFixed()}): `)
      if (!toWd.isEqualTo(amountConfirm as string))
        throw new Error(`Aborting: ${amountConfirm} <> ${toWd.toFixed()}`)
      const contract = this.container.resolve<ChannelManager>('ChannelManagerContract')
      LOG.info(`Calling hubContractWithdraw('0', '${toWd.times('1e18').toFixed(0)}')...`)
      const res = await contract.methods.hubContractWithdraw('0', toWd.times('1e18').toFixed(0)).send(callArgs)
      LOG.info(`Result of hubContractWithdraw: ${res}`)
    }

    const amountConfirm = +(await input(`Please confirm the amount of BOOTY to burn (in BOOTY, not BEI; amount: ${amount}): `))
    if (amountConfirm != amount)
      throw new Error(`Aborting: ${amount} <> ${amountConfirm}`)
    const burnAmount = Big(amount).times('1e18').toFixed()
    LOG.info(`Calling burn(${burnAmount})...`)
    const burnCall = tokenContract.methods.burn(burnAmount)
    const gas = await burnCall.estimateGas(callArgs)
    LOG.info(await burnCall.send({ ...callArgs, gas }))
  }

}
