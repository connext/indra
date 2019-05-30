import * as connext from 'connext'
import * as express from 'express'

import ChannelsService from '../ChannelsService'
import { Config } from '../Config'
import GlobalSettingsDao from '../dao/GlobalSettingsDao'
import ThreadsService from '../ThreadsService'
import { Logger, toBN } from '../util'

import { ApiService } from './ApiService'

const getLog = (config: Config): Logger => new Logger('ThreadsApiService', config.logLevel)

export default class ThreadsApiService extends ApiService<
  ThreadsApiServiceHandler
> {
  public namespace: string = 'thread'
  public routes: any = {
    'GET /:sender/to/:receiver': 'doGetThread',
    'GET /:user/active': 'doGetThreadsActive',
    'GET /:user/all': 'doGetThreads',
    'GET /:user/incoming': 'doGetThreadsIncoming',
    'GET /:user/initial-states': 'doGetInitialStates',
    'GET /:user/last-update-id': 'doGetLastUpdateId',
    'POST /:sender/to/:receiver/update': 'doUpdateThread',
  }
  public handler: any = ThreadsApiServiceHandler
  public dependencies: any = {
    channelsService: 'ChannelsService',
    config: 'Config',
    globalSettingsDao: 'GlobalSettingsDao',
    threadsService: 'ThreadsService',
  }
}

class ThreadsApiServiceHandler {
  public threadsService: ThreadsService
  public channelsService: ChannelsService
  public globalSettingsDao: GlobalSettingsDao
  public config: Config

  public async doUpdateThread(req: express.Request, res: express.Response): Promise<any> {
    const enabled = await this.ensureThreadsEnabled(req, res)
    if (!enabled) {
      return
    }
    const { sender, receiver } = req.params
    const { update } = req.body
    if (!sender || !receiver || !update) {
      getLog(this.config).warn(`Received invalid update thread request. Aborting. Body received: ${JSON.stringify(req.body)}, Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }
    res.send(
      await this.threadsService.update(sender, receiver, {
        ...update,
        balanceTokenReceiver: toBN(update.balanceTokenReceiver),
        balanceTokenSender: toBN(update.balanceTokenSender),
        balanceWeiReceiver: toBN(update.balanceWeiReceiver),
        balanceWeiSender: toBN(update.balanceWeiSender),
      }),
    )
  }

  public async doGetInitialStates(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      getLog(this.config).warn(`Receiver invalid get thread initial states request. Aborting. Params received: ${JSON.stringify(req.params)}`)
    }
    res.send(await this.threadsService.getInitialStates(user))
  }

  public async doGetThread(req: express.Request, res: express.Response) {
    const { sender, receiver } = req.params
    if (!sender || !receiver) {
      getLog(this.config).warn(`Receiver invalid get thread request. Aborting. Params received: ${JSON.stringify(req.params)}`)
    }
    let thread = await this.threadsService.getThread(sender, receiver)
    if (!thread) {
      return res.sendStatus(404)
    }
    res.send(thread)
  }

  public async doGetThreadsIncoming(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      getLog(this.config).warn(`Receiver invalid get incoming threads request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }
    res.send(await this.threadsService.getThreadsIncoming(user))
  }

  public async doGetThreads(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      getLog(this.config).warn(`Receiver invalid get incoming threads request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }
    res.send(await this.threadsService.getThreads(user))
  }

  public async doGetLastUpdateId(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      getLog(this.config).warn(`Receiver invalid get incoming threads request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }
    const latest = await this.threadsService.doGetLastUpdateId(user)
    res.json({ latestThreadUpdateId: latest })
  }

  public async doGetThreadsActive(req: express.Request, res: express.Response) {
    const { user } = req.params
    if (!user) {
      getLog(this.config).warn(`Receiver invalid get incoming threads request. Aborting. Params received: ${JSON.stringify(req.params)}`)
      return res.sendStatus(400)
    }
    res.send(await this.threadsService.getThreadsActive(user))
  }

  public async ensureThreadsEnabled(req: express.Request, res: express.Response): Promise<boolean> {
    const enabled = (await this.globalSettingsDao.fetch()).threadsEnabled
    if (!enabled) {
      getLog(this.config).warn(`Received a thread request while threads are disabled. URL: ${req.url}, params: ${JSON.stringify(req.params)}`)
      res.sendStatus(403)
      return false
    }
    return true
  }

}
