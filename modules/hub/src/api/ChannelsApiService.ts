import { UpdateRequest, convertWithdrawal } from '../vendor/connext/types'
import * as express from 'express'
import { ApiService } from './ApiService'
import log from '../util/log'
import ChannelsService from '../ChannelsService'
import { default as ChannelsDao } from '../dao/ChannelsDao'
import { Big } from '../util/bigNumber'

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
  }
}

export class ChannelsApiServiceHandler {
  channelsService: ChannelsService
  dao: ChannelsDao

  async doUpdate(req: express.Request, res: express.Response) {
    const { user } = req.params
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

    await this.channelsService.doUpdates(user, updates)

    const minUnsignedUpdate = sortedUpdates.filter(up => !!up.sigHub)[0]
    const syncUpdates = await this.channelsService.getChannelAndThreadUpdatesForSync(
      user,
      (minUnsignedUpdate || sortedUpdates[0]).txCount,
      lastThreadUpdateId,
    )

    res.send(syncUpdates)
  }

  async doRequestDeposit(req: express.Request, res: express.Response) {
    const { user } = req.params
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
      lastThreadUpdateId,
    )

    res.send(updates)
  }

  async doRequestCollateral(req: express.Request, res: express.Response) {
    const { user } = req.params
    const { activeTipperCount, activeViewerCount } = req.body

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

    res.send(await this.channelsService.doCollateralizeIfNecessary(user, activeTipperCount || 0, activeViewerCount || 0))
  }

  async doRequestExchange(req: express.Request, res: express.Response) {
    const { user } = req.params
    let { weiToSell, tokensToSell } = req.body

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

    res.send(
      await this.channelsService.doRequestExchange(
        user,
        Big(weiToSell),
        Big(tokensToSell),
      ),
    )
  }

  async doRequestWithdrawal(req: express.Request, res: express.Response) {
    const { user } = req.params
    const { tokensToSell, weiToSell, recipient, withdrawalWeiUser, withdrawalTokenUser } = req.body

    if (!user || !withdrawalWeiUser || !recipient || !withdrawalTokenUser || !weiToSell || !tokensToSell) {
      LOG.warn(
        'Received invalid withdrawal request. Aborting. Body received: {body}, Params received: {params}',
        {
          body: JSON.stringify(req.body),
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    res.send(
      await this.channelsService.doRequestWithdrawal(
        user,
        convertWithdrawal("bignumber", req.body)
      ),
    )
  }

  async doSync(req: express.Request, res: express.Response) {
    let { lastChanTx, lastThreadUpdateId } = req.query
    let { user } = req.params

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
      lastChanTx,
      lastThreadUpdateId,
    )

    res.send(syncUpdates)
  }

  async doGetChannelByUser(req: express.Request, res: express.Response) {
    const { user } = req.params
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

  async doGetChannelUpdateByTxCount(
    req: express.Request,
    res: express.Response,
  ) {
    const { user, txCount } = req.params
    if (!user || !Number.isInteger(txCount)) {
      LOG.warn(
        'Receiver invalid get channel update request. Aborting. Params received: {params}',
        {
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    const update = await this.channelsService.getChannelUpdateByTxCount(
      user,
      txCount,
    )
    if (!update) {
      return res.sendStatus(404)
    }

    res.send(update)
  }
}
