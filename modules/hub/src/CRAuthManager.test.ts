import { assert } from 'chai'
import * as sinon from 'sinon'
import { SinonStub } from 'sinon'
import * as uuid from 'uuid'

import { MemoryCRAuthManager } from './CRAuthManager'

const sandbox = sinon.createSandbox()

describe('CRAuthManager', () => {
  const ADDRESS = '0x627306090abab3a6e1400e9345bc60c78a8bef57'
  const NONCE = '7c965885-407a-4637-95cb-797dd9a8d8a2'
  const ORIGIN = 'google.com'
  const SIGNATURE = '0x23881df33e1072e8b841d026b65dda04ad36e02c7ec28ac9135a4fba6d85aad14cd2b18928994c4a177043f7309079b0283851b7b3ec03591e390cc3a554ace91c'
  const INVALID_SIGNATURE = '0x8bfc718f6402bc3a40aae4d5d54602d586f7c8c4514ceb6ef78023398943131b76a15459e7406c5562fda0274a48d87c5820af961111ac5fa3e70fbeb31ac4f31c'

  let mcrm: MemoryCRAuthManager

  beforeEach(() => {
    sandbox.stub(Date, 'now').returns(1)
    sandbox.stub(uuid, 'v4').returns(NONCE)
    mcrm = new MemoryCRAuthManager()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#checkSignature', () => {
    beforeEach(() => mcrm.generateNonce())

    it('should return the address for valid challenges', async () => {
      const res = await mcrm.checkSignature(ADDRESS, NONCE, ORIGIN, SIGNATURE)
      assert.strictEqual(res, ADDRESS)
    })

    it('should return undefined for non-existent challenges', async () => {
      const res = await mcrm.checkSignature(
        ADDRESS,
        'nope-nonce',
        ORIGIN,
        SIGNATURE,
      )
      assert.isUndefined(res)
    })

    it('should return undefined for invalid signatures', async () => {
      let res = await mcrm.checkSignature(
        ADDRESS,
        NONCE,
        ORIGIN,
        INVALID_SIGNATURE,
      )
      assert.isUndefined(res)
      res = await mcrm.checkSignature(ADDRESS, NONCE, ORIGIN, 'notsig')
      assert.isUndefined(res)
    })

    it('should return undefined for expired nonces', async () => {
      ;(Date.now as SinonStub).returns(Number.MAX_VALUE)
      const res = await mcrm.checkSignature(ADDRESS, NONCE, ORIGIN, SIGNATURE)
      assert.isUndefined(res)
    })
  })
})
