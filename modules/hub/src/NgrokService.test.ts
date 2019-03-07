import { getTestRegistry, assert } from './testing'
import { NgrokService } from './NgrokService'

describe('NgrokService', () => {
  const registry = getTestRegistry()
  const ngrok: NgrokService = registry.get('NgrokService')

  before(async function() {
    try {
      await ngrok.getDevPublicUrl()
    } catch (e) {
      console.warn('NgrokService: ngrok not running; skipping tests:', e)
      this.skip()
    }
  })

  it('should work', async() => {
    const res = await ngrok.getDevPublicUrl()
    assert.match(res, /https.*ngrok/)
  })
})
