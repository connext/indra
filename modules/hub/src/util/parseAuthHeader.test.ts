import * as express from 'express'
import {assert} from 'chai'
import parseAuthHeader from './parseAuthHeader'

describe('parseAuthHeader', () => {
  let headerValue: string

  const req = {} as express.Request

  beforeEach(() => {
    (req as any).get = () => {
      return headerValue
    }
  })

  it('should return null if no authorization header is found', () => {
    headerValue = ''
    assert.isNull(parseAuthHeader(req))
  })

  it('should return null if no bearer part is found', () => {
    headerValue = 'honk'
    assert.isNull(parseAuthHeader(req))
  })

  it('should return null if no token part is found', () => {
    headerValue = 'Bearer '
    assert.isNull(parseAuthHeader(req))
  })

  it('should return the token if the header is well-formed', () => {
    headerValue = 'Bearer honk'
    assert.strictEqual(parseAuthHeader(req), 'honk')
  })
})
