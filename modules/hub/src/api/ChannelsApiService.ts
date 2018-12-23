import { default as Config } from '../Config'
import { convertWithdrawalParameters } from '../vendor/connext/types'
import { UpdateRequest } from '../vendor/connext/types'
import * as express from 'express'
import { ApiService } from './ApiService'
import log from '../util/log'
import ChannelsService from '../ChannelsService'
import { default as ChannelsDao } from '../dao/ChannelsDao'
import { Big } from '../util/bigNumber'
import { prettySafeJson } from '../util'

const LOG = log('ChannelsApiService')

export default class ChannelsApiService extends ApiService<
  ChannelsApiServiceHandler
  > {
  namespace = 'channel'
  routes = {
    'POST /:user/request-deposit': 'doRequestDeposit',
    'POST /:user/request-collateralization': 'doRequestCollateral',
    'POST /:user/update': 'doUpdate',
    'POST /:user/request-exchange': 'doRequestExchange',
    'POST /:user/request-withdrawal': 'doRequestWithdrawal',
    'GET /:user/sync': 'doSync', // params: lastChanTx=1&lastThreadUpdateId=2
    'GET /:user': 'doGetChannelByUser',
  }
  handler = ChannelsApiServiceHandler
  dependencies = {
    channelsService: 'ChannelsService',
    dao: 'ChannelsDao',
    config: 'Config',
  }
}

export class ChannelsApiServiceHandler {
  channelsService: ChannelsService
  dao: ChannelsDao
  config: Config

  private getUser(req: express.Request) {
    const user = req.params.user.toLowerCase()
    if (!user || user != req.session!.address) {
      throw new Error(
        `Current user '${req.session!.address}' is not authorized to act ` +
        `on behalf of requested user '${user}'.`
      )
    }
    return user
  }

  async doUpdate(req: express.Request, res: express.Response) {
    const user = this.getUser(req)
    const { updates, lastThreadUpdateId } = req.body as {
      updates: UpdateRequest[]
      lastThreadUpdateId: number
    }
    if (!updates || !user || !Number.isInteger(lastThreadUpdateId)) {
      LOG.warn(
        'Received invalid update state request. Aborting. Body received: {body}, Params received: {params}',
        {
          body: JSON.stringify(req.body),
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    const sortedUpdates = updates
      .concat()
      .sort((a, b) => a.txCount - b.txCount)

    let err = null

    try {
      await this.channelsService.doUpdates(user, updates)
    } catch (e) {
      LOG.error(`Error in doUpdate('${user}', ${prettySafeJson(updates)}): ${e}\n${e.stack}`)
      err = e
    }

    const minUnsignedUpdate = sortedUpdates.filter(up => !!up.sigHub)[0]
    const syncUpdates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      (minUnsignedUpdate || sortedUpdates[0]).txCount,
      lastThreadUpdateId,
    )

    res.send({
      error: err ? '' + err + (this.config.isDev ? '\n' + err.stack : '') : null,
      updates: syncUpdates,
    })
  }

  async doRequestDeposit(req: express.Request, res: express.Response) {
    const user = this.getUser(req)
    let { depositWei, depositToken, lastChanTx, lastThreadUpdateId } = req.body
    if (!depositWei || !depositToken || !user || !Number.isInteger(lastChanTx) || !Number.isInteger(lastThreadUpdateId)) {
      LOG.warn(
        'Received invalid user deposit request. Aborting. Body received: {body}, Params received: {params}',
        {
          body: JSON.stringify(req.body),
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    await this.channelsService.doRequestDeposit(
      user,
      Big(depositWei),
      Big(depositToken),
    )
    const updates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      lastChanTx,
      0,
    )
    res.send(updates)
  }

  async doRequestCollateral(req: express.Request, res: express.Response) {
    const user = this.getUser(req)
    const { lastChanTx } = req.body


    if (!user) {
      LOG.warn(
        'Received invalid collateral request. Aborting. Body received: {body}, Params received: {params}',
        {
          body: JSON.stringify(req.body),
          params: JSON.stringify(req.params),
        },
      )
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
    const user = this.getUser(req)
    let { weiToSell, tokensToSell, lastChanTx } = req.body


    if (!user || !weiToSell || !tokensToSell) {
      LOG.warn(
        'Received invalid exchange request. Aborting. Body received: {body}, Params received: {params}',
        {
          body: JSON.stringify(req.body),
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    await this.channelsService.doRequestExchange(
      user,
      Big(weiToSell),
      Big(tokensToSell),
    )
    const updates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      lastChanTx,
      0,
    )
    res.send(updates)
  }

  async doRequestWithdrawal(req: express.Request, res: express.Response) {
    const user = this.getUser(req)
    const { tokensToSell, weiToSell, recipient, withdrawalWeiUser, withdrawalTokenUser, lastChanTx } = req.body

    if (!user || !withdrawalWeiUser || !recipient || !tokensToSell) {
      LOG.warn(
        'Received invalid withdrawal request. Aborting. Body received: {body}, Params received: {params}',
        {
          body: JSON.stringify(req.body),
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    await this.channelsService.doRequestWithdrawal(
      user,
      convertWithdrawalParameters("bignumber", req.body)
    )
    const updates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      lastChanTx,
      0,
    )
    res.send(updates)
  }

  async doSync(req: express.Request, res: express.Response) {
    const user = this.getUser(req)
    let { lastChanTx, lastThreadUpdateId } = req.query

    if (
      !user ||
      !Number.isInteger(parseInt(lastChanTx)) ||
      !Number.isInteger(parseInt(lastThreadUpdateId))
    ) {
      LOG.warn(
        'Received invalid sync request. Aborting. Params received: {params}, Query received: {query}',
        {
          params: JSON.stringify(req.params),
          query: JSON.stringify(req.query),
        },
      )
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
    const user = this.getUser(req)
    if (!user) {
      LOG.warn(
        'Receiver invalid get channel request. Aborting. Params received: {params}',
        {
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    const channel = await this.channelsService.getChannel(user)
    if (!channel) {
      return res.sendStatus(404)
    }

    res.send(channel)
  }
}
