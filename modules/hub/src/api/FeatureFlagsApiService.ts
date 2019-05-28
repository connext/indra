import * as express from 'express'

import FeatureFlagsDao, { DEFAULT_FLAGS } from '../dao/FeatureFlagsDao'
import log from '../util/log'

import { ApiService, Router } from './ApiService'

const LOG = log('FeatureFlagsApiService')

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
      LOG.error(`Caught error getting feature flags: ${err}`)

      flags = DEFAULT_FLAGS
    }

    res.send(flags)
  }
}
