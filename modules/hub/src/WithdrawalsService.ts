import { ethers as eth } from 'ethers'
import { BigNumber as BN } from 'ethers/utils'

import Config from './Config'
import GlobalSettingsDao from './dao/GlobalSettingsDao'
import WithdrawalsDao from './dao/WithdrawalsDao'
import {TotalsTuple} from './domain/TotalsTuple'
import {default as Withdrawal, WithdrawalStatus} from './domain/Withdrawal'
import { Logger, toBN } from './util'

const formatEther = eth.utils.formatEther

function p(host: any, attr: any, ...args: any[]): any {
  return new Promise(resolve => {
    host[attr](...args, (err: any, res: any) => resolve([err, res]))
  })
}

function sleep(t: number) {
  return new Promise(res => setTimeout(res, t))
}


export default class WithdrawalsService {
  private withdrawalsDao: WithdrawalsDao
  private globalSettingsDao: GlobalSettingsDao
  private web3: any
  private config: Config
  private log: Logger

  constructor (withdrawalsDao: WithdrawalsDao, globalSettingsDao: GlobalSettingsDao, web3: any, config: Config) {
    this.withdrawalsDao = withdrawalsDao
    this.globalSettingsDao = globalSettingsDao
    this.web3 = web3
    this.config = config
    this.log = new Logger('WithdrawalsService', this.config.logLevel)
  }

  public async withdrawDai(address: string): Promise<Withdrawal> {
    const enabled = (await this.globalSettingsDao.fetch()).withdrawalsEnabled

    if (!enabled) {
      this.log.error(`Blocking withdrawal attempt from ${address} while withdrawals are disabled.`)
      throw new Error('Withdrawals are disabled.')
    }

    let wd: Withdrawal | null = null

    try {
      wd = await this.withdrawalsDao.createWeiWithdrawal(address)
    } catch (err) {
      this.log.error(`Failed to created withdrawal: ${err}`)
    }

    if (!wd) {
      throw new Error('Failed to create withdrawal.')
    }

    const currentBalanceWei: BN = await new Promise<BN>((resolve: any, reject: any) => {
      this.web3.eth.getBalance(this.config.hotWalletAddress, (err: any, balance: BN) => {
        if (err)
          return reject(err)
        resolve(balance)
      })
    })

    if (currentBalanceWei.lt(wd.amountWei)) {
      this.log.error(`Attempt by "${address}" to withdraw "${formatEther(wd.amountWei)}", but hot wallet only has "${formatEther(currentBalanceWei)}"!`)
      await this.withdrawalsDao.markFailed(wd!.id)
      return wd
    }

    const newBalanceWei = currentBalanceWei.sub(wd.amountWei)
    if (newBalanceWei.lt(this.config.hotWalletMinBalance)) {
      this.log.error(`Withdrawal by "${address}" of "${formatEther(wd.amountWei)}" reduces hot wallet balance to "${formatEther(newBalanceWei)}" (which is less than the warning threshold, "${formatEther(this.config.hotWalletMinBalance)}")!`)
    }

    this.web3.eth.sendTransaction({
      from: this.config.hotWalletAddress,
      to: address,
      value: wd.amountWei
    }, (err: any, txHash: string) => {
      if (err) {
        this.log.error(`Failed to process withdrawal for address ${address}: ${err}`)

        return this.withdrawalsDao.markFailed(wd!.id)
          .catch((err) => this.log.error(`Failed to mark withdrawal for address ${address} as failed: ${err}`))
      }

      this.withdrawalsDao.markPending(wd!.id, txHash).then(() => this.pollStatus(wd!.id, txHash)).catch((err) => {
        this.log.error(`Failed to mark withdrawal for address ${address} as pending: ${err}`)

        return this.withdrawalsDao.markFailed(wd!.id).catch(() => this.log.error(`Failed to mark withdrawal for address ${address} as failed: ${err}`))
      })
    })

    return wd
  }

  public async withdraw (initiator: string, recipient: string, amount: BN, method: string = 'createChannelDisbursement'): Promise<Withdrawal> {
    const enabled = (await this.globalSettingsDao.fetch()).withdrawalsEnabled

    if (!enabled) {
      this.log.error(`Blocking withdrawal attempt from ${initiator} while withdrawals are disabled.`)
      throw new Error('Withdrawals are disabled.')
    }

    let wd: Withdrawal | null = null

    try {
      wd = await this.withdrawalsDao.createChannelDisbursement(initiator, recipient, amount)
    } catch (err) {
      this.log.error(`Failed to created withdrawal for ${initiator}: ${err}`)
    }

    if (!wd) {
      throw new Error('Failed to create withdrawal for ' + initiator)
    }

    const currentBalanceWei: BN = await new Promise<BN>((resolve: any, reject: any) => {
      this.web3.eth.getBalance(this.config.hotWalletAddress, (err: any, balance: BN) => {
        return err ? reject(err) : resolve(balance)
      })
    })

    if (currentBalanceWei.lt(amount)) {
      this.log.error(`Attempt by "${initiator}" to withdraw "${formatEther(toBN(amount))}", but hot wallet only has "${formatEther(currentBalanceWei)}"!`)
      await this.withdrawalsDao.markFailed(wd!.id)
      return wd
    }

    const newBalanceWei = currentBalanceWei.sub(amount)
    if (newBalanceWei.lt(toBN(this.config.hotWalletMinBalance))) {
      this.log.error(`Withdrawal by "${initiator}" of "${formatEther(toBN(amount))}" reduces hot wallet balance to "${formatEther(newBalanceWei)}" (which is less than the warning threshold, "${formatEther(this.config.hotWalletMinBalance)}")!`)
    }

    let [err, txHash] = await p(this.web3.eth, 'sendTransaction', {
      from: this.config.hotWalletAddress,
      to: recipient,
      value: amount
    })
    if (err) {
      this.log.error(`Failed to process withdrawal for address ${initiator}: ${err}`)

      await this.withdrawalsDao.markFailed(wd!.id)
      return wd
    }

    await this.withdrawalsDao.markPending(wd!.id, txHash)
    
    try {
      await this.pollStatus(wd!.id, txHash)
    } catch (err) {
      this.log.error(`Error while polling for status of withdrawal ${wd!.id} at txhash ${txHash} from ${initiator}: ${err}`)

      await this.withdrawalsDao.markFailed(wd!.id)
      return wd
    }

    return wd
  }

  public totalFor (address: string, status: WithdrawalStatus): Promise<TotalsTuple> {
    return this.withdrawalsDao.totalFor(address, status)
  }

  /**
   * Continually polls the blockchain for the confirmation status of the given transaction.
   * Marks the transaction's withdrawal as either failed (upon timeout) or confirmed (upon
   * confirmation).
   *
   * @param {number} wdId
   * @param {string} txHash
   */
  private async pollStatus (wdId: number, txHash: string) {
    const maxAttempts = 600

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await sleep(1000)

      this.log.info(`Checking status of withdrawal ${wdId} with txhash ${txHash}...`)
      const [err, res] = await p(this.web3.eth, 'getTransaction', txHash)
      if (err) {
        this.log.error(`Got error from Web3 while polling status for ${wdId}: ${err}`)
        continue
      }

      if (!res || res.blockNumber === null) {
        this.log.info(`Withdrawal ${wdId} with tx hash ${txHash} not found or unconfirmed. Retrying. Attempt ${attempt} of ${maxAttempts}`)
        continue
      }

      this.log.info(`Withdrawal ${wdId} with tx hash ${txHash} has been confirmed.`)

      await this.withdrawalsDao.markConfirmed(wdId)
      return
    }

    this.log.error(`Withdrawal ${wdId} with txhash ${txHash} timed out.`)

    await this.withdrawalsDao.markFailed(wdId)
  }
}
