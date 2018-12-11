import { getChannel } from '../lib/getChannel'
import CurrencyConvertable from '../lib/currency/CurrencyConvertable'
import { CurrencyType } from '../state/ConnextState/CurrencyTypes'
import getExchangeRates from '../lib/getExchangeRates'
import getTxCount from '../lib/getTxCount'
import { getLastThreadId } from '../lib/getLastThreadId'
import { syncEnqueueItems } from '../lib/syncEnqueueItems'
import bootyToBEI from '../lib/currency/bootyToBEI'
import { gt, eq } from '../lib/math'
import { BOOTY } from '../lib/constants'
import * as actions from '../state/actions'
import { AbstractController } from './AbstractController'
import { BigNumber } from 'bignumber.js'
import { convertChannelState } from '../types'

export class ExchangeController extends AbstractController {
  private unsubscribeController: any
  private ratePollInterval: any

  async start() {
    await this.pollExchangeRates()
    this.ratePollInterval = setInterval(this.pollExchangeRates, 1000 * 60 * 6.9)
    this.unsubscribeController = this.store.subscribe(this.exchangeWeiIfNeeded)
  }

  async stop() {
    if (this.unsubscribeController) {
      this.unsubscribeController()
      this.unsubscribeController = null
    }
    clearInterval(this.ratePollInterval)
  }

  private pollExchangeRates = async () => {
    try {
      const rates = await this.hub.getExchangerRates()
      this.store.dispatch(actions.setExchangeRates({
        lastUpdated: new Date(),
        rates: rates,
      }))
    } catch (e) {
      console.error('Error polling for exchange rates:', e)
      // TODO: properly log this, once API logger is in
    }
  }

  private exchangeWeiIfNeeded = async () => {
    const { balanceTokenUser, balanceWeiUser } = getChannel(this.store)

    if (gt(balanceTokenUser, bootyToBEI(1).amount) || eq(balanceWeiUser, '0')) {
      return
    }

    const convertableWeiInBooty = new CurrencyConvertable(
      CurrencyType.WEI,
      balanceWeiUser,
      () => getExchangeRates(this.store)
    ).toBOOTY()
    if (convertableWeiInBooty.amountBigNumber.lt(1)) {
      return
    }

    if (this.store.getState().runtime.hasActiveExchange) {
      return
    }

    this.store.dispatch(actions.setHasActiveExchange(true))

    try {
      await this.requestBooty()
    } catch (e) {
      // TODO log to API
      this.store.dispatch(actions.setHasActiveExchange(false))
      throw e
    }
  }

  private requestBooty = async () => {
    const rates = getExchangeRates(this.store)
    const prev = convertChannelState('bn', getChannel(this.store))
    const args = await this.hub.requestExchange(prev.balanceWeiUser.toString(), '0')
    // TODO: validate that args are correct:
    // - weiToSell is <= the requestedAmount
    // - tokensToSell is 0
    // - exchange rate is within tollerances

    syncEnqueueItems(this.store, [{
      type: 'channel',
      state: {
        reason: 'Exchange',
        args: args,
        state: await this.connext.signChannelState(
          this.connext.stateGenerator.exchange(prev, args),
        ),
      }
    }])
  }
}
