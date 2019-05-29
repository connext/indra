import * as connext from 'connext'
import * as express from 'express'

import { ApiService } from './ApiService'

import ChannelsService from '../ChannelsService'
import GlobalSettingsDao from '../dao/GlobalSettingsDao'
import ThreadsService from '../ThreadsService'
import { Logger, toBN } from '../util'

const log = new Logger('ThreadsApiService')

export default class ThreadsApiService extends ApiService<
  ThreadsApiServiceHandler
> {
  namespace = 'thread'
  routes = {
    'POST /:sender/to/:receiver/update': 'doUpdateThread',
    'GET /:sender/to/:receiver': 'doGetThread',
    'GET /:user/initial-states': 'doGetInitialStates',
    'GET /:user/incoming': 'doGetThreadsIncoming',
    'GET /:user/active': 'doGetThreadsActive',
    'GET /:user/last-update-id': 'doGetLastUpdateId',
    'GET /:user/all': 'doGetThreads',
  }
  handler = ThreadsApiServiceHandler
  dependencies = {
    threadsService: 'ThreadsService',
    channelsService: 'ChannelsService',
    globalSettingsDao: 'GlobalSettingsDao'
  }
}

class ThreadsApiServiceHandler {
  threadsService: ThreadsService
  channelsService: ChannelsService
  globalSettingsDao: GlobalSettingsDao

  async doUpdateThread(req: express.Request, res: express.Response) {
    const enabled = await this.ensureThreadsEnabled(req, res)
    if (!enabled) {
      return
    }

    const { sender, receiver } = req.params
    const { update } = req.body

    if (!sender || !receiver || !update) {
      log.warn(`Received invalid update thread request. Aborting. Body received: ${JSON.stringify(req.body)}, Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    res.send(
      await this.threadsService.update(sender, receiver, {
        ...update,
        balanceWeiSender: toBN(update.balanceWeiSender),
        balanceWeiReceiver: toBN(update.balanceWeiReceiver),
        balanceTokenSender: toBN(update.balanceTokenSender),
        balanceTokenReceiver: toBN(update.balanceTokenReceiver),
      }),
    )
  }

  async doGetInitialStates(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      log.warn(`Receiver invalid get thread initial states request. Aborting. Params received: ${JSON.stringify(req.params)}`)
    }

    res.send(await this.threadsService.getInitialStates(user))
  }

  async doGetThread(req: express.Request, res: express.Response) {
    const { sender, receiver } = req.params
    if (!sender || !receiver) {
      log.warn(`Receiver invalid get thread request. Aborting. Params received: ${JSON.stringify(req.params)}`)
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
      log.warn(`Receiver invalid get incoming threads request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    res.send(await this.threadsService.getThreadsIncoming(user))
  }

  async doGetThreads(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      log.warn(`Receiver invalid get incoming threads request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }
    res.send(await this.threadsService.getThreads(user))
  }

  async doGetLastUpdateId(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      log.warn(`Receiver invalid get incoming threads request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }
    const latest = await this.threadsService.doGetLastUpdateId(user)
    res.json({ latestThreadUpdateId: latest })
  }

  async doGetThreadsActive(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      log.warn(`Receiver invalid get incoming threads request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }

    res.send(await this.threadsService.getThreadsActive(user))
  }

  async ensureThreadsEnabled(req: express.Request, res: express.Response): Promise<boolean> {
    const enabled = (await this.globalSettingsDao.fetch()).threadsEnabled

    if (!enabled) {
      log.warn(`Received a thread request while threads are disabled. URL: ${req.url}, params: ${JSON.stringify(req.params)}`)
      res.sendStatus(403)
      return false
    }

    return true
  }
}
