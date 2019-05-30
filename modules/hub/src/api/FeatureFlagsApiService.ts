import * as express from 'express'

import { Config } from '../Config'
import FeatureFlagsDao, { DEFAULT_FLAGS } from '../dao/FeatureFlagsDao'
import { Logger } from '../util'

import { ApiService, Router } from './ApiService'

const getLog = (config: Config): Logger => new Logger('FeatureFlagsApiService', config.logLevel)

export default class FeatureFlagsApiService extends ApiService<FeatureFlagsApiHandler> {
  public namespace: string = 'featureflags'
  public routes: any = {
    'GET /': 'doFeatureFlags',
  }
  public handler: any = FeatureFlagsApiHandler
  public dependencies: any = {
    config: 'Config',
    flagsDao: 'FeatureFlagsDao',
  }
}

class FeatureFlagsApiHandler {
  private flagsDao: FeatureFlagsDao
  private config: Config

  public async doFeatureFlags (req: express.Request, res: express.Response): Promise<void> {
    let flags

    try {
      flags = await this.flagsDao.flagsFor(req.address)
    } catch (err) {
      getLog(this.config).error(`Caught error getting feature flags: ${err}`)

      flags = DEFAULT_FLAGS
    }

    res.send(flags)
  }
}
