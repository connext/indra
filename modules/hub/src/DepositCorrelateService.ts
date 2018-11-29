import LedgerChannelsDao, { UpdateReason } from './dao/LedgerChannelsDao'
import ChainsawLcDao from './dao/ChainsawLcDao'
import { ChainsawDeposit, LcStateUpdate } from './domain/LedgerChannel'
import log from './util/log'

const LOG = log('DepositCorrelateService')

export default class DepositCorrelateService {
  private ledgerChannelsDao: LedgerChannelsDao

  private chainsawDao: ChainsawLcDao

  constructor(
    ledgerChannelsDao: LedgerChannelsDao,
    chainsawDao: ChainsawLcDao,
  ) {
    this.ledgerChannelsDao = ledgerChannelsDao
    this.chainsawDao = chainsawDao
  }

  public async correlateDeposits(): Promise<ChainsawDeposit[]> {
    const channels = await this.chainsawDao.ledgerChannels()
    const untrackedEth: ChainsawDeposit[] = []
    const untrackedToken: ChainsawDeposit[] = []
    await Promise.all(
      channels.map(async channel => {
        let deposits = await this.chainsawDao.ledgerChannelDepositsByChannelId(
          channel.channelId,
        )

        const ethDeposits = []
        const tokenDeposits = []
        for (const deposit of deposits) {
          if (
            deposit.recipient.toLowerCase() !== channel.partyA.toLowerCase()
          ) {
            continue
          }

          if (deposit.isToken) {
            tokenDeposits.push(deposit)
          } else {
            ethDeposits.push(deposit)
          }
        }

        const stateUpdates = await this.ledgerChannelsDao.getStateUpdates(
          channel.channelId,
        )

        const eth = await this.setCorrelation(ethDeposits, stateUpdates, false)
        const token = await this.setCorrelation(
          tokenDeposits,
          stateUpdates,
          true,
        )

        untrackedEth.push(...eth)
        untrackedToken.push(...token)
      }),
    )

    return [...untrackedEth, ...untrackedToken]
  }

  private async setCorrelation(
    deposits: ChainsawDeposit[],
    stateUpdates: LcStateUpdate[],
    isToken: boolean,
  ): Promise<ChainsawDeposit[]> {
    const repeats: any = {}
    const untrackedDeposits: ChainsawDeposit[] = []
    for (const deposit of deposits) {
      let depositFound = false

      for (let i = 0; i < stateUpdates.length; i++) {
        const update = stateUpdates[i]
        if (update.reason !== UpdateReason.LcDeposit) {
          continue
        }
        // updates are in reverse-nonce order
        let amount, previousUpdate
        if (i + 1 !== stateUpdates.length) {
          previousUpdate = stateUpdates[i + 1]
        }
        if (!previousUpdate) {
          // first update is deposit
          if (isToken) {
            amount = update.tokenBalanceA
          } else {
            amount = update.ethBalanceA
          }
        } else {
          if (isToken) {
            amount = update.tokenBalanceA.minus(previousUpdate.tokenBalanceA)
          } else {
            amount = update.ethBalanceA.minus(previousUpdate.ethBalanceA)
          }
        }
        const amountStr = amount.toString()
        if (
          Array.isArray(repeats[amountStr]) &&
          repeats[amountStr].indexOf(i) !== -1
        ) {
          // need to check if state update has been checked yet
          continue
        }
        if (amount.equals(deposit.deposit)) {
          depositFound = true
          if (Array.isArray(repeats[amountStr])) {
            repeats[amountStr].push(i)
          } else {
            repeats[amountStr] = [i]
          }
          if (!deposit.updateId) {
            LOG.info(
              'Found state update and deposit that are not correlated in DB, correlating...',
            )
            await this.chainsawDao.correlateDeposit(
              deposit.depositId,
              update.id,
            )
          }
          break
        }
      }

      if (!depositFound) {
        LOG.info('Found untracked deposit for amount {amt}', {
          amt: deposit.deposit.toString(),
        })
        untrackedDeposits.push(deposit)
      }
    }
    return untrackedDeposits
  }
}
