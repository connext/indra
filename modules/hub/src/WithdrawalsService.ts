import WithdrawalsDao from './dao/WithdrawalsDao'
import {default as Withdrawal, WithdrawalStatus} from './domain/Withdrawal'
import {TotalsTuple} from './domain/TotalsTuple'
import Config from './Config'
import log from './util/log'
import GlobalSettingsDao from './dao/GlobalSettingsDao'
import { BigNumber as BN } from 'ethers/utils'
import { ethers } from 'ethers';
import { big } from 'connext'

const { Big, toWeiBig } = big;
const LOG = log('WithdrawalsService')

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

  constructor (withdrawalsDao: WithdrawalsDao, globalSettingsDao: GlobalSettingsDao, web3: any, config: Config) {
    this.withdrawalsDao = withdrawalsDao
    this.globalSettingsDao = globalSettingsDao
    this.web3 = web3
    this.config = config
  }

  public async withdrawUsd(address: string): Promise<Withdrawal> {
    const enabled = (await this.globalSettingsDao.fetch()).withdrawalsEnabled

    if (!enabled) {
      LOG.error('Blocking withdrawal attempt from {address} while withdrawals are disabled.', {
        address
      })
      throw new Error('Withdrawals are disabled.')
    }

    let wd: Withdrawal | null = null

    try {
      wd = await this.withdrawalsDao.createWeiWithdrawal(address)
    } catch (err) {
      LOG.error('Failed to created withdrawal: {err}', {
        err
      })
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
      LOG.error('Attempt by "{address}" to withdraw "{amountEth}", but hot wallet only has "{walletAmountEth}"!', {
        address,
        amountEth: ethers.utils.formatEther(wd.amountWei),
        walletAmountEth: ethers.utils.formatEther(currentBalanceWei),
      })
      await this.withdrawalsDao.markFailed(wd!.id)
      return wd
    }

    const newBalanceWei = currentBalanceWei.sub(wd.amountWei)
    if (newBalanceWei.lt(this.config.hotWalletMinBalance)) {
      LOG.error('Withdrawal by "{address}" of "{wdAmountEth}" reduces hot wallet balance to "{newBalanceEth}" (which is less than the warning threshold, "{hotWalletMinBalanceEth}")!', {
        address,
        wdAmountEth: ethers.utils.formatEther(wd.amountWei),  
        newBalanceEth: ethers.utils.formatEther(newBalanceWei),
        hotWalletMinBalanceEth: ethers.utils.formatEther(this.config.hotWalletMinBalance),
      })
    }

    this.web3.eth.sendTransaction({
      from: this.config.hotWalletAddress,
      to: address,
      value: wd.amountWei
    }, (err: any, txHash: string) => {
      if (err) {
        LOG.error('Failed to process withdrawal for address {address}: {err}', {
          address,
          err
        })

        return this.withdrawalsDao.markFailed(wd!.id)
          .catch((err) => LOG.error('Failed to mark withdrawal for address {address} as failed: {err}', {
            address,
            err
          }))
      }

      this.withdrawalsDao.markPending(wd!.id, txHash).then(() => this.pollStatus(wd!.id, txHash)).catch((err) => {
        LOG.error('Failed to mark withdrawal for address {address} as pending: {err}', {
          address,
          err
        })

        return this.withdrawalsDao.markFailed(wd!.id).catch(() => LOG.error('Failed to mark withdrawal for address {address} as failed: {err}', {
          address,
          err
        }))
      })
    })

    return wd
  }

  public async withdraw (initiator: string, recipient: string, amount: BN, method: string = 'createChannelDisbursement'): Promise<Withdrawal> {
    const enabled = (await this.globalSettingsDao.fetch()).withdrawalsEnabled

    if (!enabled) {
      LOG.error('Blocking withdrawal attempt from {address} while withdrawals are disabled.', {
        address: initiator
      })
      throw new Error('Withdrawals are disabled.')
    }

    let wd: Withdrawal | null = null

    try {
      wd = await this.withdrawalsDao.createChannelDisbursement(initiator, recipient, amount)
    } catch (err) {
      LOG.error('Failed to created withdrawal for {address}: {err}', {
        address: initiator,
        err,
      })
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
      LOG.error('Attempt by "{address}" to withdraw "{amountEth}", but hot wallet only has "{walletAmountEth}"!', {
        address: initiator,
        amountEth: ethers.utils.formatEther(Big(amount)),
        walletAmountEth: ethers.utils.formatEther(currentBalanceWei),
      })
      await this.withdrawalsDao.markFailed(wd!.id)
      return wd
    }

    const newBalanceWei = currentBalanceWei.sub(amount)
    if (newBalanceWei.lt(Big(this.config.hotWalletMinBalance))) {
      LOG.error('Withdrawal by "{address}" of "{wdAmountEth}" reduces hot wallet balance to "{newBalanceEth}" (which is less than the warning threshold, "{hotWalletMinBalanceEth}")!', {
        address: initiator,
        wdAmountEth: ethers.utils.formatEther(Big(amount)),
        newBalanceEth: ethers.utils.formatEther(newBalanceWei),
        hotWalletMinBalanceEth: ethers.utils.formatEther(this.config.hotWalletMinBalance),
      })
    }

    let [err, txHash] = await p(this.web3.eth, 'sendTransaction', {
      from: this.config.hotWalletAddress,
      to: recipient,
      value: amount
    })
    if (err) {
      LOG.error('Failed to process withdrawal for address {address}: {err}', {
        address: initiator,
        err
      })

      await this.withdrawalsDao.markFailed(wd!.id)
      return wd
    }

    await this.withdrawalsDao.markPending(wd!.id, txHash)
    
    try {
      await this.pollStatus(wd!.id, txHash)
    } catch (err) {
      LOG.error('Error while polling for status of withdrawal {id} at txhash {txHash} from {address}: {err}', {
        id: wd!.id,
        txHash,
        address: initiator,
        err
      })

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

      LOG.info('Checking status of withdrawal {wdId} with txhash {txHash}...', {
        wdId,
        txHash
      })
      const [err, res] = await p(this.web3.eth, 'getTransaction', txHash)
      if (err) {
        LOG.error('Got error from Web3 while polling status for {wdId}: {err}', {
          wdId,
          err
        })
        continue
      }

      if (!res || res.blockNumber === null) {
        LOG.info('Withdrawal {wdId} with tx hash {txHash} not found or unconfirmed. Retrying. Attempt {attempt} of {maxAttempts}', {
          wdId,
          txHash,
          attempt,
          maxAttempts
        })
        continue
      }

      LOG.info('Withdrawal {wdId} with tx hash {txHash} has been confirmed.', {
        wdId,
        txHash
      })

      await this.withdrawalsDao.markConfirmed(wdId)
      return
    }

    LOG.error('Withdrawal {wdId} with txhash {txHash} timed out.', {
      wdId,
      txHash
    })

    await this.withdrawalsDao.markFailed(wdId)
  }
}
