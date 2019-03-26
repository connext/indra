import * as crypto from 'crypto'
import { default as DBEngine } from '../DBEngine'
import { CoinPaymentsApiClient } from './CoinPaymentsApiClient'
import { default as Config } from '../Config'
import { CoinPaymentsDao, CoinPaymentsIpnRow, CoinPaymentsDepositAddress } from './CoinPaymentsDao'
import { default as ChannelsDao } from '../dao/ChannelsDao'
import { prettySafeJson, parseQueryString, safeInt } from '../util'
import { PaymentArgs, convertChannelState, DepositArgs } from '../vendor/connext/types'
import { Validator } from '../vendor/connext/validator'
import { SignerService } from '../SignerService'
import { BigNumber } from 'bignumber.js/bignumber'
import { hasPendingOps } from '../vendor/connext/hasPendingOps'
import { default as ExchangeRateDao } from '../dao/ExchangeRateDao'
import { default as ChannelsService } from '../ChannelsService'
import { default as log } from '../util/log'

const LOG = log('CoinPaymentsService')

// See also: https://www.coinpayments.net/merchant-tools-ipn
export type CoinPaymentsIpnData = {
  ipn_version: string
  ipn_type: string
  ipn_mode: string
  ipn_id: string

  merchant: string

  status: string
  status_text: string

  address: string
  txn_id: string
  amount: string
  confirms: string
  currency: string
  fee: string

  fiat_coin: string
  fiat_amount: string
  fiat_fee: string

  // For convenience, store the raw IPN data and signature here too
  sig: string
  rawData: string
}

// Example IPNs:
// [hub] GOT IPN AT 2019-01-12T22:06:03.015Z : 55fe999470126470100aa1385bd6d768347c72b4409320012f3038043f8c352383296472885369a6656b579369db57dab836e4948fe615c8923847df2ca918c0 { address: '0x5ac519e43cb2c904bcce55ebb12e6f1b2218b0b0',
// [hub]   amount: '0.01173525',
// [hub]   amounti: '1173525',
// [hub]   confirms: '8',
// [hub]   currency: 'ETH',
// [hub]   fee: '0.00005868',
// [hub]   feei: '5868',
// [hub]   fiat_amount: '1.46808038',
// [hub]   fiat_amounti: '146808038',
// [hub]   fiat_coin: 'USD',
// [hub]   fiat_fee: '0.00734087',
// [hub]   fiat_feei: '734087',
// [hub]   ipn_id: 'faf25de6a6f874dad7685dd799e1fe22',
// [hub]   ipn_mode: 'hmac',
// [hub]   ipn_type: 'deposit',
// [hub]   ipn_version: '1.0',
// [hub]   merchant: '898d6ead05235f6081e97a58a6699289',
// [hub]   status: '100',
// [hub]   status_text: 'Deposit confirmed',
// [hub]   txn_id: '0xd0dec626a8273c7b43914e428f7ff25397cc5bd4610f93bbd7633566fb375a24' }
// 
// [hub] GOT: { 'user-agent': 'CoinPayments.net IPN Generator',
// [hub]   host: '1ffe2986.ngrok.io',
// [hub]   accept: '*/*',
// [hub]   hmac: '55fe999470126470100aa1385bd6d768347c72b4409320012f3038043f8c352383296472885369a6656b579369db57dab836e4948fe615c8923847df2ca918c0',
// [hub]   'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
// [hub]   'content-length': '474',
// [hub]   'x-forwarded-proto': 'https',
// [hub]   'x-forwarded-for': '149.56.241.110' }
// [hub] GOT IPN AT 2019-01-12T22:18:02.952Z : 55fe999470126470100aa1385bd6d768347c72b4409320012f3038043f8c352383296472885369a6656b579369db57dab836e4948fe615c8923847df2ca918c0 { address: '0x5ac519e43cb2c904bcce55ebb12e6f1b2218b0b0',
// [hub]   amount: '0.01173525',
// [hub]   amounti: '1173525',
// [hub]   confirms: '8',
// [hub]   currency: 'ETH',
// [hub]   fee: '0.00005868',
// [hub]   feei: '5868',
// [hub]   fiat_amount: '1.46808038',
// [hub]   fiat_amounti: '146808038',
// [hub]   fiat_coin: 'USD',
// [hub]   fiat_fee: '0.00734087',
// [hub]   fiat_feei: '734087',
// [hub]   ipn_id: 'faf25de6a6f874dad7685dd799e1fe22',
// [hub]   ipn_mode: 'hmac',
// [hub]   ipn_type: 'deposit',
// [hub]   ipn_version: '1.0',
// [hub]   merchant: '898d6ead05235f6081e97a58a6699289',
// [hub]   status: '100',
// [hub]   status_text: 'Deposit confirmed',
// [hub]   txn_id: '0xd0dec626a8273c7b43914e428f7ff25397cc5bd4610f93bbd7633566fb375a24' }

// Make this just a bit larger than the amount on CoinPayments - $250 - to make
// sure we don't accidentally reject things if CoinPayments does something
// weird like send us $250.01.
export const COINPAYMENTS_MAX_DEPOSIT_FIAT = 300

export class CoinPaymentsService {
  constructor(
    private config: Config,
    private api: CoinPaymentsApiClient,
    private dao: CoinPaymentsDao,
    private db: DBEngine,
    private channelsService: ChannelsService,
    private channelDao: ChannelsDao,
    private exchangeRateDao: ExchangeRateDao,
  ) {}

  generateHmac(key: string, rawData: string): string {
    return crypto
      .createHmac('sha512', key)
      .update(rawData)
      .digest('hex')
  }

  parseIpnData(sig: string, rawData: string): CoinPaymentsIpnData {
    // Reference: https://www.coinpayments.net/downloads/cpipn.phps
    LOG.info(`Parsing CoinPaymentsIPN: '${sig}' '${rawData}'`)

    const expectedSig = this.generateHmac(this.config.coinpaymentsIpnSecret, rawData)
    if (expectedSig != sig) {
      LOG.error(`IPN signature failed to verify. Expected: '${expectedSig}'; actual: '${sig}'; data: '${rawData}'`)
      return null
    }

    const data = parseQueryString(rawData)
    if (data.merchant != this.config.coinpaymentsMerchantId) {
      LOG.error(`Invalid CoinPayments merchant: ${data.merchant} != ${this.config.coinpaymentsMerchantId}`)
      return null
    }

    return {
      ...data,
      status: safeInt(data.status),
      sig,
      rawData,
    }
  }

  async handleCoinPaymentsIpn(user: string, ipn: CoinPaymentsIpnData): Promise<CoinPaymentsIpnRow | null> {
    await this.dao.saveIpnLog(user, ipn)

    if (+ipn.status < 0) {
      LOG.error(`Received IPN with error status: ${JSON.stringify(ipn)}`)
      return
    }

    if (+ipn.status < 100) {
      LOG.info(`Received IPN with status < 100; ignoring: ${JSON.stringify(ipn)}`)
      return
    }

    const cur = await this.dao.getIpnByIpnId(ipn.ipn_id)
    if (cur) {
      LOG.error(
        `Received duplicate IPN. The previous IPN has already been handled ` +
        `and this one will be ignored. This is not *necessarily* an error, but ` +
        `should likely be investigated to figure out what's going on. ` +
        `Old IPN: ${JSON.stringify(cur)}. New IPN: ${JSON.stringify(ipn)}.`
      )
      return
    }

    return await this.db.withTransaction(async () => {
      // TODO: assert that the address payments are being sent to was generated
      // for this user
      const ipnRow = await this.dao.saveIpn(user, ipn)
      const creditRowId = await this.dao.createUserCredit(ipnRow)
      await this.attemptInsertUserCreditForDepositFromTransaction(creditRowId)
      return ipnRow
    })
  }

  async getUserDepositAddress(user: string, currency: string): Promise<CoinPaymentsDepositAddress> {
    const curAddr = await this.dao.getUserDepositAddress(user, currency)
    // It's unclear how long CoinPayments will hold these addresses for, so for
    // now generate a new adddress if the old one is more than 24h out of date.
    if (curAddr && Date.now() - +curAddr.createdOn < 1000 * 60 * 60 * 24)
      return curAddr

    const res = await this.api.getCallbackAddress(user, currency)
    if (!res.address)
      throw new Error('CoinPayments API did not return an address: ' + JSON.stringify(res))

    await this.dao.saveUserDepositAddress(user, currency, res)
    return res
  }

  async attemptInsertUserCreditForDepositFromTransaction(creditRowId: number) {
    // 1. Get user channel (to acquire lock)
    // 2. Calculate amount to deposit
    // 3. Create coinpayments_user_credits
    // 4. Nudge the CoinPaymentsDepositPollingService to attempt the deposit

    const credit = await this.dao.getUserCreditForUpdate(creditRowId)
    const ipn = await this.dao.getIpnByRowId(credit.ipnId)
    LOG.info(`Attempting to credit ${credit.user} for IPN ${ipn.ipnId}...`)

    if (credit.proposePendingId) {
      LOG.info(`Credit has already been applied (a proposePendingId exists); doing nothing.`)
      return
    }

    const { user } = credit

    // Get and check the channel state
    const channel = await this.channelDao.getChannelOrInitialState(user)
    if (channel.status != 'CS_OPEN') {
      LOG.info(`Channel ${user} is not open (${channel.status}); can't apply IPN credit yet (will retry)`)
      return null
    }
    if (hasPendingOps(channel.state)) {
      LOG.info(`Channel ${user} has pending operations; can't apply IPN credit yet (will retry)`)
      return null
    }
  
    // Check to see if there's already a pending operation
    const currentPendingRedis = await this.channelsService.redisGetUnsignedState('any', user)
    if (currentPendingRedis) {
      const age = (Date.now() - currentPendingRedis.timestamp) / 1000
      if (age < 60) {
        LOG.info(
          `Current pending state on ${user} is only` +
          `${age.toFixed()}s old; will not attempt IPN credit until that's ` +
          `more than 60s old.`
        )
        return
      }
    }

    // Check the IPN
    if (ipn.currencyFiat != 'USD') {
      throw new Error(
        `Refusing to credit user for IPN where fiat currency != USD: ` +
        `${prettySafeJson(ipn)}`
      )
    }

    if (ipn.amountFiat.isGreaterThan(COINPAYMENTS_MAX_DEPOSIT_FIAT)) {
      throw new Error(
        `Refusing to credit user for IPN where amount > ` +
        `COINPAYMENTS_MAX_DEPOSIT_FIAT (this should have been enforced by ` +
        `the CoinPayments API, but apparently was not). Deposit amount: ` +
        `${ipn.amountFiat.toFixed()}, COINPAYMENTS_MAX_DEPOSIT_FIAT: ` +
        `${COINPAYMENTS_MAX_DEPOSIT_FIAT}.`
      )
    }

    if (ipn.status < 100) {
      throw new Error(
        `Refusing to credit user for IPN with status < 100: ` +
        `${prettySafeJson(ipn)}`
      )
    }

    // Get current exchange rate
    const currentExchangeRate = await this.exchangeRateDao.getUsdRateAtTime(ipn.createdOn)

    // Calculate the amount to deposit: deposit up to channelBeiLimit, then
    // credit the rest as wei
    const beiLimit = BigNumber.max(
      0,
      this.config.channelBeiLimit.minus(channel.state.balanceTokenUser),
    )

    // Since 1 BOOTY = 1 USD, credit the user for the fiat amount in bei
    // (the .floor() is _probably_ unnecessary, but just in case CoinPayments
    // sends us a fiat value with more than 18 decimal places).
    const ipnAmountToken = ipn.amountFiat.times('1e18').floor()
    const amountToken = BigNumber.min(beiLimit, ipnAmountToken)
    const remainingBeiToCredit = ipnAmountToken.minus(amountToken)
    const amountWei = remainingBeiToCredit.div(currentExchangeRate).floor()

    const depositArgs: DepositArgs = {
      depositWeiHub: '0',
      depositTokenHub: '0',
      depositWeiUser: amountWei.toFixed(),
      depositTokenUser: amountToken.toFixed(),
      timeout: 0,
      sigUser: null,
      reason: {
        ipn: ipn.ipnId,
        // For debugging, not actually used anywhere
        exchangeRate: currentExchangeRate.toFixed(),
      },
    }

    LOG.info(`Creating unsigned ProposePending to credit ${user} for IPN ${ipn.ipnId}: ${JSON.stringify(depositArgs)}`)
    await this.channelsService.redisSaveUnsignedState('hub-authorized', user, {
      reason: 'ProposePendingDeposit',
      args: depositArgs,
    })
  }

}
