import {assert} from 'chai'
import {Response} from 'supertest'
import { getTestRegistry, TestApiServer } from '../testing'
import { DEFAULT_FLAGS } from '../dao/FeatureFlagsDao'

describe('FeatureFlagsApiService', () => {
  (DEFAULT_FLAGS as any).testFlag = 'default value'
  const registry = getTestRegistry({
    'FeatureFlagsDao': {
      async flagsFor(user: string) {
        console.log('USER:', user)
        if (user == 'good-user') {
          return {
            testFlag: 'good value'
          }
        } else {
          throw new Error('expected error')
        }
      },
    },
  })

  const dao = registry.get('FeatureFlagsDao')
  const app: TestApiServer = registry.get('TestApiServer')

  describe('GET /featureflags/', () => {
    it('should return feature flags for a given user', () => {
      return app.withUser('good-user').request
        .get('/featureflags')
        .expect(200)
        .then((res: Response) => {
          assert.containSubset(res.body, {
            testFlag: 'good value'
          })
        })
    })

    it('should return default flags if the database returns an error', () => {
      return app.withUser('bad-user').request
        .get('/featureflags')
        .expect(200)
        .then((res: Response) => {
          assert.containSubset(res.body, {
            testFlag: 'default value'
          })
        })
    })
  })
})
