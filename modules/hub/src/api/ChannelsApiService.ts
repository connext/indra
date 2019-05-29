import * as connext from 'connext'
import { UpdateRequest } from 'connext/types'
import * as express from 'express'

import ChannelsService from '../ChannelsService'
import { default as Config } from '../Config'
import { default as ChannelsDao } from '../dao/ChannelsDao'
import { BN, Logger, prettySafeJson, toBN } from '../util'
import { getUserFromRequest } from '../util/request'

import { ApiService } from './ApiService'

export default class ChannelsApiService extends ApiService<ChannelsApiServiceHandler> {
  public namespace: string = 'channel'
  public routes: any = {
    'GET /:user': 'doGetChannelByUser',
    'GET /:user/debug': 'doGetChannelDebug',
    'GET /:user/latest-no-pending': 'doGetLastStateNoPendingOps',
    'GET /:user/latest-update': 'doGetLatestDoubleSignedState',
    'GET /:user/sync': 'doSync', // params: lastChanTx=1&lastThreadUpdateId=2
    'POST /:user/request-collateralization': 'doRequestCollateral',
    'POST /:user/request-deposit': 'doRequestDeposit',
    'POST /:user/request-exchange': 'doRequestExchange',
    'POST /:user/request-withdrawal': 'doRequestWithdrawal',
    'POST /:user/update': 'doUpdate',
  }
  public handler: any = ChannelsApiServiceHandler
  public dependencies: any = {
    channelsService: 'ChannelsService',
    config: 'Config',
    dao: 'ChannelsDao',
  }
}

export class ChannelsApiServiceHandler {
  public channelsService: ChannelsService
  public dao: ChannelsDao
  public config: Config
  private log: Logger

  public constructor() {
    this.log = new Logger('ChannelsApiService')
  }

  public async doUpdate(req: express.Request, res: express.Response): Promise<any> {
    const user = getUserFromRequest(req)
    const { updates, lastThreadUpdateId } = req.body as {
      updates: UpdateRequest[]
      lastThreadUpdateId: number,
    }
    if (!updates || !user || !Number.isInteger(lastThreadUpdateId)) {
      this.log.warn(
        `Received invalid update state request. Aborting. ` +
        `Body received: ${JSON.stringify(req.body)}, ` +
        `Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    if (!updates.length) {
      res.send({
        error: null,
        updates: [],
        msg: 'Did not recieve any updates.',
      })
      return
    }

    const sortedUpdates = updates
      .concat()
      .sort((a, b) => a.txCount - b.txCount)

    let err = null

    try {
      await this.channelsService.doUpdates(user, sortedUpdates)
    } catch (e) {
      this.log.error(`Error in doUpdate('${user}', ${prettySafeJson(updates)}): ${e}\n${e.stack}`)
      err = e
    }

    const syncUpdates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      sortedUpdates[0].txCount - 1,
      lastThreadUpdateId,
    )

    res.send({
      error: err ? '' + err + (!this.config.isProduction ? '\n' + err.stack : '') : null,
      updates: syncUpdates,
    })
  }

  async doRequestDeposit(req: express.Request, res: express.Response) {
    const user = getUserFromRequest(req)
    let { depositWei, depositToken, lastChanTx, lastThreadUpdateId, sigUser } = req.body
    if (!depositWei || !depositToken || !user || !sigUser || !Number.isInteger(lastChanTx) || !Number.isInteger(lastThreadUpdateId)) {
      this.log.warn(
        `Received invalid user deposit request. Aborting. ` +
        `Body received: ${JSON.stringify(req.body)}, ` +
        `Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    const err = await this.channelsService.doRequestDeposit(
      user,
      toBN(depositWei),
      toBN(depositToken),
      sigUser,
    )
    if (err) {
      res.status(400)
      res.send({ error: err })
      return
    }

    const updates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      lastChanTx,
      0,
    )
    res.send(updates)
  }

  async doRequestCollateral(req: express.Request, res: express.Response) {
    const { user } = req.params
    const { lastChanTx } = req.body


    if (!user) {
      this.log.warn(
        `Received invalid collateral request. Aborting. Body received: ${JSON.stringify(req.body)}, Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    await this.channelsService.doCollateralizeIfNecessary(user)
    const updates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      lastChanTx,
      0,
    )
    res.send(updates)
  }

  async doRequestExchange(req: express.Request, res: express.Response) {
    const { user } = req.params
    let { weiToSell, tokensToSell, lastChanTx } = req.body


    if (!user || !weiToSell || !tokensToSell) {
      this.log.warn(
        `Received invalid exchange request. Aborting. Body received: ${JSON.stringify(req.body)}, Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    await this.channelsService.doRequestExchange(
      user,
      toBN(weiToSell),
      toBN(tokensToSell),
    )
    const updates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      lastChanTx,
      0,
    )
    res.send(updates)
  }

  async doRequestWithdrawal(req: express.Request, res: express.Response) {
    const { user } = req.params
    const { tokensToSell, weiToSell, recipient, withdrawalWeiUser, withdrawalTokenUser, lastChanTx, exchangeRate } = req.body

    if (
      !user || 
      !recipient ||
      !Number.isInteger(parseInt(withdrawalWeiUser)) || 
      !Number.isInteger(parseInt(tokensToSell)) ||
      // TODO: token withdrawals
      // !Number.isInteger(parseInt(weiToSell)) || 
      // !Number.isInteger(parseInt(withdrawalTokenUser)) ||
      !exchangeRate
    ) {
      this.log.warn(
        `Received invalid withdrawal request. Aborting. Body received: ${JSON.stringify(req.body)}, Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    await this.channelsService.doRequestWithdrawal(
      user,
      connext.convert.WithdrawalParameters("bn", req.body)
    )
    const updates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      lastChanTx,
      0,
    )
    res.send(updates)
  }

  async doSync(req: express.Request, res: express.Response) {
    let { lastChanTx, lastThreadUpdateId } = req.query
    let { user } = req.params

    if (
      !user ||
      !Number.isInteger(parseInt(lastChanTx)) ||
      !Number.isInteger(parseInt(lastThreadUpdateId))
    ) {
      this.log.warn(
        `Received invalid sync request. Aborting. Params received: ${JSON.stringify(req.params)}, Query received: ${JSON.stringify(req.query)}`)
      return res.sendStatus(400)
    }

    let syncUpdates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      parseInt(lastChanTx),
      parseInt(lastThreadUpdateId),
    )

    res.send(syncUpdates)
  }

  async doGetChannelByUser(req: express.Request, res: express.Response) {
    // const user = getUserFromRequest(req)
    const { user } = req.params
    // TODO: we get the user from the params like this in other places,
    // but does not seem to check the auth?
    if (!user) {
      this.log.warn(
        `Receiver invalid get channel request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    const channel = await this.channelsService.getChannel(user)
    if (!channel) {
      return res.sendStatus(404)
    }

    res.send(channel)
  }

  async doGetLastStateNoPendingOps(req: express.Request, res: express.Response) {
    const user = getUserFromRequest(req)
    if (!user) {
      this.log.warn(
        `Receiver invalid get channel request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    const channel = await this.channelsService.getLastStateNoPendingOps(user)
    if (!channel) {
      return res.sendStatus(404)
    }

    res.send(channel.state)
  }

  async doGetLatestDoubleSignedState(req: express.Request, res: express.Response) {
    const user = getUserFromRequest(req)
    if (!user) {
      this.log.warn(
        `Receiver invalid get channel request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    const channel = await this.channelsService.getLatestDoubleSignedState(user)
    if (!channel) {
      return res.sendStatus(404)
    }

    res.send(channel)
  }

  async doGetChannelDebug(req: express.Request, res: express.Response) {
    const user = getUserFromRequest(req)
    const channel = await this.dao.getChannelOrInitialState(user)
    const { updates: recentUpdates } = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      Math.max(0, channel.state.txCountGlobal - 10),
      0, // TODO REB-36: enable threads
    )
    res.send({
      channel,
      recentUpdates: recentUpdates.reverse(),
    })
  }
}
