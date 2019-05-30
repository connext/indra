import { assert } from 'chai'
import { Response } from 'supertest'

import { DEFAULT_FLAGS } from '../dao/FeatureFlagsDao'
import { getTestRegistry, TestApiServer } from '../testing'
import { getTestConfig } from '../testing/mocks'
import { Logger } from '../util'

const logLevel = 0

describe('FeatureFlagsApiService', () => {
  (DEFAULT_FLAGS as any).testFlag = 'default value'
  const registry = getTestRegistry({
    Config: getTestConfig({ logLevel }),
    'FeatureFlagsDao': {
      async flagsFor(user: string): Promise<any> {
        if (user === 'good-user') {
          return { testFlag: 'good value' }
        }
        throw new Error('expected error')
      },
    },
  })

  const dao = registry.get('FeatureFlagsDao')
  const app: TestApiServer = registry.get('TestApiServer')

  describe('GET /featureflags/', () => {
    it('should return feature flags for a given user', () => {
      app.withUser('good-user').request
        .get('/featureflags')
        .set('x-address', 'good-user')
        .expect(200)
        .then((res: Response) => {
          assert.containSubset(res.body, { testFlag: 'good value' })
        })
    })

    it('should return default flags if the database returns an error', () => {
      app.withUser('bad-user').request
        .get('/featureflags')
        .set('x-address', 'bad-user')
        .expect(200)
        .then((res: Response) => {
          assert.containSubset(res.body, { testFlag: 'default value' })
        })
    })
  })
})
