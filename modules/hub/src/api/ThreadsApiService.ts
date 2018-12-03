import * as express from 'express'
import { ApiService } from './ApiService'
import log from '../util/log'
import ThreadsService from '../ThreadsService'
import { BigNumber } from 'bignumber.js'
import ChannelsService from '../ChannelsService'
import { Big } from '../util/bigNumber'
import { isBoolean } from 'util'

const LOG = log('ThreadsApiService')

export default class ThreadsApiService extends ApiService<
  ThreadsApiServiceHandler
> {
  namespace = 'thread'
  routes = {
    'POST /:sender/to/:receiver/update': 'doUpdateThread',
    'GET /:sender/to/:receiver': 'doGetThread',
    'GET /:user/initial-states': 'doGetInitialStates',
    'GET /:user/incoming': 'doGetThreadsIncoming',
  }
  handler = ThreadsApiServiceHandler
  dependencies = {
    threadsService: 'ThreadsService',
    channelsService: 'ChannelsService',
  }
}

class ThreadsApiServiceHandler {
  threadsService: ThreadsService
  channelsService: ChannelsService

  async doUpdateThread(req: express.Request, res: express.Response) {
    const { sender, receiver } = req.params
    const { update } = req.body

    if (!sender || !receiver || !update) {
      LOG.warn(
        'Received invalid update thread request. Aborting. Body received: {body}, Params received: {params}',
        {
          body: JSON.stringify(req.body),
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    res.send(
      await this.threadsService.update(sender, receiver, {
        ...update,
        balanceWeiSender: Big(update.balanceWeiSender),
        balanceWeiReceiver: Big(update.balanceWeiReceiver),
        balanceTokenSender: Big(update.balanceTokenSender),
        balanceTokenReceiver: Big(update.balanceTokenReceiver),
      }),
    )
  }

  async doGetInitialStates(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      LOG.warn(
        'Receiver invalid get thread initial states request. Aborting. Params received: {params}',
        {
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    res.send(await this.threadsService.getInitialStates(user))
  }

  async doGetThread(req: express.Request, res: express.Response) {
    const { sender, receiver } = req.params
    if (!sender || !receiver) {
      LOG.warn(
        'Receiver invalid get thread request. Aborting. Params received: {params}',
        {
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    let thread = await this.threadsService.getThread(sender, receiver)
    if (!thread) {
      return res.sendStatus(404)
    }

    res.send(thread)
  }

  async doGetThreadsIncoming(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      LOG.warn(
        'Receiver invalid get incoming threads request. Aborting. Params received: {params}',
        {
          params: JSON.stringify(req.params),
        },
      )
      return res.sendStatus(400)
    }

    res.send(await this.threadsService.getThreadsIncoming(user))
  }
}
