import * as Connext from '../Connext';
import { getUserFromRequest } from '../util/request'
import { default as Config } from '../Config'
import * as express from 'express'
import { ApiService } from './ApiService'
import log from '../util/log'
import ChannelsService from '../ChannelsService'
import { default as ChannelsDao } from '../dao/ChannelsDao'
import { prettySafeJson } from '../util'

const Big = Connext.big.Big
type UpdateRequest = Connext.types.UpdateRequest
const convertWithdrawalParameters = Connext.types.convertWithdrawalParameters
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
    'GET /:user/debug': 'doGetChannelDebug',
    'GET /:user': 'doGetChannelByUser',
    'GET /:user/latest-update': 'doGetLatestDoubleSignedState',
    'GET /:user/latest-no-pending': 'doGetLastStateNoPendingOps',
    'POST /:user/sync': 'doSync', // params: lastChanTx=1&lastThreadUpdateId=2
    'POST /:user/debug': 'doGetChannelDebug',
    'POST /:user': 'doGetChannelByUser',
    'POST /:user/latest-update': 'doGetLatestDoubleSignedState',
    'POST /:user/latest-no-pending': 'doGetLastStateNoPendingOps',
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

  async doUpdate(req: express.Request, res: express.Response) {
    const user = getUserFromRequest(req)
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
      LOG.error(`Error in doUpdate('${user}', ${prettySafeJson(updates)}): ${e}\n${e.stack}`)
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
      LOG.warn(
        'Received invalid user deposit request. Aborting. Body received: {body}, Params received: {params}',
        {
          body: JSON.stringify(req.body),
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    const err = await this.channelsService.doRequestDeposit(
      user,
      Big(depositWei),
      Big(depositToken),
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
    const { user } = req.params
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
      convertWithdrawalParameters("bn", req.body)
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
    // const user = getUserFromRequest(req)
    const { user } = req.params
    // TODO: we get the user from the params like this in other places,
    // but does not seem to check the auth?
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

  async doGetLastStateNoPendingOps(req: express.Request, res: express.Response) {
    const user = getUserFromRequest(req)
    if (!user) {
      LOG.warn(
        'Receiver invalid get channel request. Aborting. Params received: {params}',
        {
          params: JSON.stringify(req.params),
        },
      )
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
      LOG.warn(
        'Receiver invalid get channel request. Aborting. Params received: {params}',
        {
          params: JSON.stringify(req.params),
        },
      )
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
