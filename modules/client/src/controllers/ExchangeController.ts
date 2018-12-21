import getExchangeRates from '../lib/getExchangeRates'
import * as actions from '../state/actions'
import { AbstractController } from './AbstractController'
import { ConnextStore } from '../state/store'
import { Poller } from '../lib/poller/Poller';
import { ConnextInternal } from '../Connext';
import { BEI_AMOUNT, FINNEY_AMOUNT, WEI_AMOUNT } from '../lib/constants'
import getTxCount from '../lib/getTxCount';
import BigNumber from 'bignumber.js';

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
    this.poller = new Poller(this.logger)
  }

  async start() {
    await this.poller.start(
      this.pollExchangeRates,
      ExchangeController.POLLER_INTERVAL_LENGTH
    )
  }

  async stop() {
    this.poller.stop()
  }

  private pollExchangeRates = async () => {
    try {
      const rates = await this.hub.getExchangerRates()
      if (rates.USD) {
        // These are the values wallet expects
        rates.USD = new BigNumber(rates.USD).toFixed(2)
        rates.BEI = (new BigNumber(rates.USD)).times(new BigNumber(BEI_AMOUNT)).toFixed(0)
        rates.WEI = new BigNumber(WEI_AMOUNT).toFixed(0)
        rates.ETH = new BigNumber(1).toFixed(0)
        rates.BOOTY = new BigNumber(rates.USD).toFixed(0)
        rates.FINNEY = new BigNumber(FINNEY_AMOUNT).toFixed(0)

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
    const weiToSell = currency === "wei" ? toSell : '0'
    const tokensToSell = currency === "token" ? toSell : '0'
    const sync = await this.hub.requestExchange(weiToSell, tokensToSell, getTxCount(this.store))
    this.connext.syncController.enqueueSyncResultsFromHub(sync)

  }
}
