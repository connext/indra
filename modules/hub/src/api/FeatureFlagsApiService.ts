import * as express from 'express'

import { ApiService, Router } from './ApiService'

import FeatureFlagsDao, { DEFAULT_FLAGS } from '../dao/FeatureFlagsDao'
import log from '../util/log'

const LOG = log('FeatureFlagsApiService')

export default class FeatureFlagsApiService extends ApiService<FeatureFlagsApiHandler> {
  namespace = 'featureflags'
  routes = {
    'GET /': 'doFeatureFlags',
  }
  handler = FeatureFlagsApiHandler
  dependencies = {
    'flagsDao': 'FeatureFlagsDao',
  }
}

class FeatureFlagsApiHandler {
  flagsDao: FeatureFlagsDao

  public async doFeatureFlags (req: express.Request, res: express.Response) {
    let flags

    try {
      flags = await this.flagsDao.flagsFor(req.session!.address)
    } catch (err) {
      LOG.error(
        'Caught error getting feature flags: {err}',
        {
          err
        }
      )

      flags = DEFAULT_FLAGS
    }

    res.send(flags)
  }
}
