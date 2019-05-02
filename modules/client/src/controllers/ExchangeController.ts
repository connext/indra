import { AbstractController } from './AbstractController'
import { ConnextInternal } from '../Connext';
import { Big, mul, toWeiBig, toWeiString } from '../lib/bn';
import { BEI_AMOUNT, FINNEY_AMOUNT, WEI_AMOUNT } from '../lib/constants'
import { getExchangeRates, getTxCount } from '../state/getters'
import { Poller } from '../lib/poller/Poller';
import * as actions from '../state/actions'
import { ConnextStore } from '../state/store'

const ONE_MINUTE = 1000 * 60

export function validateExchangeRate(store: ConnextStore, rate: string) {
  const rates = getExchangeRates(store.getState())
  if (!rates || !rates.USD) {
    return (
      `No exchange rates set in store.`
    )
  }
  const delta = Math.abs(+rates.USD - +rate)
  const allowableDelta = +rates.USD * 0.02
  if (delta > allowableDelta) {
    // TODO: send an invalidating state back to the hub (REB-12)
    return (
      `Proposed exchange rate '${rate}' exceeds ` +
      `difference from current rate '${rates.USD}'`
    )
  }
}

export class ExchangeController extends AbstractController {
  static POLLER_INTERVAL_LENGTH = ONE_MINUTE

  private poller: Poller

  constructor(name: string, connext: ConnextInternal) {
    super(name, connext)
    this.poller = new Poller({
      name: 'ExchangeController',
      interval: ExchangeController.POLLER_INTERVAL_LENGTH,
      callback: this.pollExchangeRates.bind(this),
      timeout: 60 * 1000,
    })
  }

  async start() {
    await this.poller.start()
  }

  async stop() {
    this.poller.stop()
  }

  private pollExchangeRates = async () => {
    try {
      const rates = await this.hub.getExchangeRates()
      if (rates.USD) {
        // These are the values wallet expects
        rates.USD = rates.USD,
        rates.BEI = toWeiString(rates.USD) // multiply by bei amt = 10e18
        rates.WEI = Big(WEI_AMOUNT).toString()
        rates.ETH = Big(1).toString()
        rates.BOOTY = rates.USD
        rates.FINNEY = Big(FINNEY_AMOUNT).toString()

        this.store.dispatch(actions.setExchangeRate({
          lastUpdated: new Date(),
          rates,
        }))
      }
    } catch (e) {
      console.error('Error polling for exchange rates:', e)
      // TODO: properly log this, once API logger is in
    }
  }

  public exchange = async (toSell: string, currency: "wei" | "token") => {
    if (currency != "wei" && currency != "token") {
      throw new Error(`Currency type not detected. Must provide either "wei" or "token" to indicate which type of currency you are sellling with exchange.`)
    }
    if (!toSell || toSell == '0' || Big(toSell).lt(0)) {
      throw new Error(`Invalid toSell amount provided. Must be greater than 0.`)
    }

    const weiToSell = currency === "wei" ? toSell : '0'
    const tokensToSell = currency === "token" ? toSell : '0'
    // before requesting exchange, verify the user has enough wei 
    // and tokens
    const channel = this.getState().persistent.channel
    if (Big(channel.balanceWeiUser).lt(weiToSell) || Big(channel.balanceTokenUser).lt(tokensToSell)) {
      console.error(`User does not have sufficient wei or token for exchange. Wei: ${weiToSell}, tokens: ${tokensToSell}, channel: ${JSON.stringify(channel, null, 2)}`)
      return
    }
    const sync = await this.hub.requestExchange(weiToSell, tokensToSell, getTxCount(this.store.getState()))
    this.connext.syncController.handleHubSync(sync)

  }
}
