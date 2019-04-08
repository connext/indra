import * as sinon from 'sinon'
import * as uuid from 'uuid'
import { assert } from 'chai'
import { MemoryCRAuthManager } from './CRAuthManager'
import { SinonStub } from 'sinon'

const sandbox = sinon.createSandbox()

const Web3 = require('web3')

describe('MemoryCRAuthManager', () => {
  const ADDRESS = '0x0108d76118d97b88aa40167064cb242fa391effa'

  const NONCE = '7c965885-407a-4637-95cb-797dd9a8d8a2'

  const ORIGIN = 'google.com'

  const SIGNATURE =
    '0x01613cc7bc53acf9a8b4bbfd1db267826840c8d7e086b56e302a7ec2bde6202a3295432aaf2a97304b05316d23e1854e8ed4f0eefd8c2f65cdeae15d331404c71c'

  const SIGNATURE_FOR_SOMETHING_ELSE =
    '0x8bfc718f6402bc3a40aae4d5d54602d586f7c8c4514ceb6ef78023398943131b76a15459e7406c5562fda0274a48d87c5820af961111ac5fa3e70fbeb31ac4f31c'

  let mcrm: MemoryCRAuthManager

  beforeEach(() => {
    sandbox.stub(Date, 'now').returns(1)
    sandbox.stub(uuid, 'v4').returns(NONCE)
    // no provider needed since we're only using sha3
    mcrm = new MemoryCRAuthManager(new Web3('http://localhost:8545'))
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('#checkSignature', () => {
    beforeEach(() => {
      return mcrm.generateNonce()
    })

    it('should return the address for valid challenges', async () => {
      const res = await mcrm.checkSignature(ADDRESS, NONCE, ORIGIN, SIGNATURE)
      assert.strictEqual(res, ADDRESS)
    })

    it('should return null for non-existent challenges', async () => {
      const res = await mcrm.checkSignature(
        ADDRESS,
        'nope-nonce',
        ORIGIN,
        SIGNATURE,
      )
      assert.isNull(res)
    })

    it('should return null for invalid signatures', async () => {
      let res = await mcrm.checkSignature(
        ADDRESS,
        NONCE,
        ORIGIN,
        SIGNATURE_FOR_SOMETHING_ELSE,
      )
      assert.isNull(res)
      res = await mcrm.checkSignature(ADDRESS, NONCE, ORIGIN, 'notsig')
      assert.isNull(res)
    })

    it('should return null for invalid origins', async () => {
      const res = await mcrm.checkSignature(
        ADDRESS,
        NONCE,
        'google.net',
        SIGNATURE,
      )
      assert.isNull(res)
    })

    it('should return null for expired nonces', async () => {
      ;(Date.now as SinonStub).returns(Number.MAX_VALUE)
      const res = await mcrm.checkSignature(ADDRESS, NONCE, ORIGIN, SIGNATURE)
      assert.isNull(res)
    })
  })
})
