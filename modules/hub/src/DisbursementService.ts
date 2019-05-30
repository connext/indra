import Config from './Config'
import erc20TransferAbi from './contract/erc20TransferAbi'
import DisbursementDao from './dao/DisbursementsDao'
import Disbursement from './domain/Disbursement'
import { Logger, toBN } from './util'

const DISBURSEMENT_AMOUNT_FINNEY = 45
const DISBURSEMENT_AMOUNT_BEI = 69

export default class DisbursementService {
  private disbursementDao: DisbursementDao
  private web3: any
  private config: Config
  private log: Logger

  public constructor(disbursementDao: DisbursementDao, web3: any, config: Config) {
    this.disbursementDao = disbursementDao
    this.web3 = web3
    this.config = config
    this.log = new Logger('DisbursementService', this.config.logLevel)
  }

  public async disburse (address: string): Promise<Disbursement> {
    const current = await this.disbursementDao.getCurrentByAddress(address)
    if (current) {
      throw new Error('Pending or confirmed disbursement exists for this address.')
    }

    let disbursement: Disbursement | null = null
    try {
      disbursement = await this.disbursementDao.create(
        address.toLowerCase(),
        toBN(
          this.web3.utils.toWei(
            DISBURSEMENT_AMOUNT_FINNEY.toString(),
            'finney',
          ),
        ),
      )
    } catch (err) {
      this.log.error(`Failed to create disbursement: ${err}`)
    }

    if (!disbursement) {
      throw new Error('Failed to create disbursement.')
    }

    let receipt
    try {
      receipt = await this.web3.eth.sendTransaction({
        from: this.config.hotWalletAddress,
        to: address,
        value: disbursement.amountWei,
      })
    } catch (err) {
      this.log.error(`Failed to process disbursement for address ${address}: ${err}`)
      return this.disbursementDao.markFailed(disbursement.id)
    }

    try {
      await this.disbursementDao.markPending(
        disbursement.id,
        receipt.transactionHash,
      )
      this.pollStatus(disbursement.id, receipt.transactionHash)
    } catch (err) {
      this.log.error(`Failed to mark disbursement for address ${address} as pending: ${err}`)
      return this.disbursementDao.markFailed(disbursement.id)
    }

    return disbursement
  }

  public async disburseErc20 (address: string): Promise<Disbursement> {
    const current = await this.disbursementDao.getCurrentByAddressErc20(address)
    if (current) {
      throw new Error(
        'Pending or confirmed ERC-20 disbursement exists for this address.'
      )
    }

    let disbursement: Disbursement | null = null
    try {
      disbursement = await this.disbursementDao.createErc20(
        address.toLowerCase(),
        toBN(DISBURSEMENT_AMOUNT_BEI)
      )
    } catch (err) {
      this.log.error(`Failed to create ERC-20 disbursement: ${err}`)
    }

    if (!disbursement) {
      throw new Error('Failed to create ERC-20 disbursement.')
    }

    const imm = (disbursement: Disbursement) => (() => {
      const contract = new this.web3.eth.Contract(
        erc20TransferAbi,
        process.env.TOKEN_CONTRACT_ADDRESS
      )

      contract.methods.transfer(
        address,
        disbursement.amountErc20
      ).send({
        from: this.config.hotWalletAddress
      }).catch((err: any) => {
        this.log.error(`Failed to process ERC-20 disbursement for address ${address}: ${err}`)

        throw err
      }).then((receipt: { transactionHash: string }) => this.disbursementDao.markPending(
        disbursement.id,
        receipt.transactionHash
      )).then((disbursement: Disbursement) => {
        this.pollStatus(disbursement.id, disbursement.txHash)
      }).catch(() => {
        this.disbursementDao.markFailed(disbursement.id).catch((err: any) => {
          this.log.error(`Failed to mark disbursement as pending/failed: ${err}`)
        })
      })
    })

    // need IIFE to silence typescript strict null checks
    setImmediate(imm(disbursement))

    return disbursement
  }

  public async getCurrentByAddress (
    address: string
  ): Promise<Disbursement | null> {
    return this.disbursementDao.getCurrentByAddress(address.toLowerCase())
  }

  public async getCurrentByAddressErc20 (
    address: string
  ): Promise<Disbursement | null> {
    return this.disbursementDao.getCurrentByAddressErc20(address.toLowerCase())
  }

  public async getByAddressAndId (
    address: string, id: number
  ): Promise<Disbursement | null> {
    return this.disbursementDao.getByAddressAndId(address.toLowerCase(), id)
  }

  /**
   * Continually polls the blockchain for the confirmation status of the given transaction.
   * Marks the transaction's withdrawal as either failed (upon timeout) or confirmed (upon
   * confirmation).
   *
   * @param {number} wdId
   * @param {string} txHash
   */
  private pollStatus (disbursementId: number, txHash: string) {
    const maxAttempts = 600
    let attempt = 0

    const poll = async () => {
      if (attempt === maxAttempts) {
        this.log.error(`Disbursement ${disbursementId} with txhash ${txHash} timed out.`)

        this.disbursementDao.markFailed(disbursementId).catch(err =>
          this.log.error(`Failed to mark disbursement ${disbursementId} as failed: ${err}`)
        )

        return
      }

      attempt++

      try {
        const res = await this.web3.eth.getTransaction(txHash)
        if (res.blockNumber === null) {
          this.log.info(`Disbursement ${disbursementId} with tx hash ${txHash} unconfirmed. Retrying. Attempt ${attempt} of ${maxAttempts}`)

          setTimeout(poll, 1000)
          return
        }

        this.log.info(`Disbursement ${disbursementId} with tx hash ${txHash} has been confirmed.`)

        this.disbursementDao.markConfirmed(disbursementId).catch(err =>
          this.log.error(`Failed to mark disbursement ${disbursementId} as confirmed: ${err}`)
        )
      } catch (err) {
        this.log.error(`Got error from Web3 while polling status for ${disbursementId}: ${err}`)

        setTimeout(poll, 1000)
        return
      }
    }

    poll()
  }
}
