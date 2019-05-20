import { ethers as eth } from 'ethers'

import { ConnextInternal } from '../Connext'
import { toBN, toWei } from '../lib/bn'
import { Poller } from '../lib/poller'
import * as actions from '../state/actions'
import { getExchangeRates, getTxCount } from '../state/getters'
import { ConnextStore } from '../state/store'

import { AbstractController } from './AbstractController'

const ONE_MINUTE = 1000 * 60

export const validateExchangeRate = (store: ConnextStore, rate: string): string | undefined => {
  const rates = getExchangeRates(store.getState())
  if (!rates || !rates.DAI) {
    return (
      `No exchange rates set in store.`
    )
  }
  const delta = Math.abs(+rates.DAI - +rate)
  const allowableDelta = +rates.DAI * 0.02
  if (delta > allowableDelta) {
    // TODO: send an invalidating state back to the hub (REB-12)
    return (
      `Proposed exchange rate '${rate}' exceeds ` +
      `difference from current rate '${rates.DAI}'`
    )
  }
}

export class ExchangeController extends AbstractController {
  private static POLLER_INTERVAL_LENGTH: number = ONE_MINUTE
  private poller: Poller

  public constructor(name: string, connext: ConnextInternal) {
    super(name, connext)
    this.poller = new Poller({
      callback: this.pollExchangeRates.bind(this),
      interval: ExchangeController.POLLER_INTERVAL_LENGTH,
      name: 'ExchangeController',
      timeout: 60 * 1000,
    })
  }

  public async start(): Promise<void> {
    await this.poller.start()
  }

  public async stop(): Promise<void> {
    this.poller.stop()
  }

  private pollExchangeRates = async (): Promise<void> => {
    try {
      const rates = await this.hub.getExchangeRates()
      const WeiPerEther = eth.constants.WeiPerEther
      if (rates.DAI) {
        // These are the values wallet expects
        rates.DAI = rates.DAI
        rates.ETH = toBN(1).toString()
        rates.FIN = WeiPerEther.div(eth.utils.parseUnits('1', 'finney')).toString()
        rates.WEI = WeiPerEther.toString()

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

  public exchange = async (toSell: string, currency: 'wei' | 'token'): Promise<any> => {
    if (currency !== 'wei' && currency !== 'token') {
      throw new Error(
        `Currency type not detected. Must provide either 'wei' or 'token' to ` +
        `indicate which type of currency you are sellling with exchange.`)
    }
    if (!toSell || toSell === '0' || toBN(toSell).lt(0)) {
      throw new Error(`Invalid toSell amount provided. Must be greater than 0.`)
    }

    const weiToSell = currency === 'wei' ? toSell : '0'
    const tokensToSell = currency === 'token' ? toSell : '0'
    // before requesting exchange, verify the user has enough wei and tokens
    const channel = this.getState().persistent.channel
    if (
      toBN(channel.balanceWeiUser).lt(weiToSell)
      || toBN(channel.balanceTokenUser).lt(tokensToSell)
    ) {
      console.error(
        `User does not have sufficient wei or token for exchange. ` +
        `Wei: ${weiToSell}, tokens: ${tokensToSell}, ` +
        `channel: ${JSON.stringify(channel, undefined, 2)}`)
      return
    }
    const sync = await this.hub.requestExchange(
      weiToSell, tokensToSell, getTxCount(this.store.getState()),
    )
    this.connext.syncController.handleHubSync(sync)

  }
}
