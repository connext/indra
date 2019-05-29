import * as express from 'express'

import FeatureFlagsDao, { DEFAULT_FLAGS } from '../dao/FeatureFlagsDao'
import { Logger } from '../util'

import { ApiService, Router } from './ApiService'

const log = new Logger('FeatureFlagsApiService')

export default class FeatureFlagsApiService extends ApiService<FeatureFlagsApiHandler> {
  public namespace: string = 'featureflags'
  public routes: any = {
    'GET /': 'doFeatureFlags',
  }
  public handler: any = FeatureFlagsApiHandler
  public dependencies: any = {
    'flagsDao': 'FeatureFlagsDao',
  }
}

class FeatureFlagsApiHandler {
  public flagsDao: FeatureFlagsDao

  public async doFeatureFlags (req: express.Request, res: express.Response): Promise<void> {
    let flags

    try {
      flags = await this.flagsDao.flagsFor(req.address)
    } catch (err) {
      log.error(`Caught error getting feature flags: ${err}`)

      flags = DEFAULT_FLAGS
    }

    res.send(flags)
  }
}
