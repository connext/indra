import * as eth from 'ethers'
import Web3 from 'web3'

import * as ChannelManagerAbi from './contract/ChannelManagerAbi.json'
import { BN, isBN, toBN } from './lib'
import * as t from './testing'
import {
  convertChannelState,
  convertFields,
  convertThreadState,
  convertVerboseEvent,
  insertDefault,
  makeEventVerbose,
  objMap,
  objMapPromise,
} from './types'
import { Validator } from './validator'

const assert = t.assert

describe('Type Utils', () => {
  describe('insertDefault', () => {
    it('should work', () => {
      const tst = {
        testing: undefined,
        tokensToSell: '10',
      }
      const keys = [
        'testing',
        'all',
        'zeroes',
      ]
      const ans = insertDefault('0', tst, keys)
      assert.containSubset(ans, {
        all: '0',
        testing: '0',
        tokensToSell: '10',
        zeroes: '0',
      })
    })
  })

  describe('convertChannelState', () => {
    it('should work for strings', () => {
      const obj = t.getChannelState('empty')
      const unsigned = convertChannelState('str-unsigned', obj)
      assert.equal(Object.keys(unsigned).indexOf('sigHub'), -1)
      assert.equal(Object.keys(unsigned).indexOf('sigUser'), -1)
    })

    it('should work for bn', () => {
      const obj = t.getChannelState('empty')
      const unsigned = convertChannelState('bn-unsigned', obj)
      assert.equal(Object.keys(unsigned).indexOf('sigHub'), -1)
      assert.equal(Object.keys(unsigned).indexOf('sigUser'), -1)
    })
  })

  describe('convertThreadState', () => {
    it('should work for strings', () => {
      const obj = t.getThreadState('empty')
      const unsigned = convertThreadState('str-unsigned', obj)
      assert.equal(Object.keys(unsigned).indexOf('sigA'), -1)
    })

    it('should work for bn', () => {
      const obj = t.getChannelState('empty')
      const unsigned = convertChannelState('bn-unsigned', obj)
      assert.equal(Object.keys(unsigned).indexOf('sigA'), -1)
    })
  })

  describe('convertFields', () => {
    const types = ['str', 'bn']
    const examples: any = {
      'bn': toBN('69'),
      'str': '69',
    }

    for (const fromType of types) {
      for (const toType of types) {
        it(`should convert ${fromType} -> ${toType}`, () => {
          const res = convertFields(
            fromType as any, toType as any, ['foo'], { foo: examples[fromType] },
          )
          assert.deepEqual(res, {
            foo: examples[toType],
          })
        })
      }
    }
  })

  describe('objMap', () => {
    // should apply the same function to every value in the given
    // object
    it('should work with promises', async () => {
      const obj = {
        me: toBN(7),
        out: new Promise((resolve: any, rej: any): any => resolve('10')),
        test: 'str',
      }

      const res = await objMapPromise(
        obj,
        async (val: any, field: any): Promise<any> => field,
      ) as any

      assert.deepEqual(res, {
        me: toBN(7),
        out: '10',
        test: 'str',
      })
    })

    it('should work with constant members', async () => {
      let args = {
        bn: toBN(8),
        num: 19,
        str: 'This IS A CASIng TesT',
      }
      args = objMap(args, (k: any, v: any): any => typeof v === 'string' ? v.toLowerCase() : v)
      assert.deepEqual(args, {
        bn: toBN(8),
        num: 19,
        str: 'this is a casing test',
      })
    })
  })

  /**
   * NOTE: This test was added to test a *specific* event on mainnet from a
   * transaction while debugging disputes.
   *
   * You can use the same structure if debugging in the future, but this is
   * designed specifically to run against the production or staging that are live.
   *
   * It is safe to skip this test.
   *
   * TODO: dispute e2e testing on the hub, then delete this!
   */
  describe.skip('makeEventVerbose', () => {

    // instantiate a validator with mainnet provider
    const hubAddress = '0x925488C7cD7E5eB3441885c6C1dfdBEa875E08F7'.toLowerCase()
    const contractAddress = '0xdfa6edAe2EC0cF1d4A60542422724A48195A5071'.toLowerCase()
    const txHash = '0xfff66539056d9656196f380c04a51c346d9da532bea1dbb0c909756fb05af0e6'
    const ethUrl = ''

    it('makeEventVerbose should work with mainnet hub', async () => {
      const web3 = new Web3(ethUrl)
      const provider = web3.eth

      const validator = new Validator(hubAddress, provider, ChannelManagerAbi.abi)

      // get receipt
      const tx = await provider.getTransaction(txHash)
      const receipt = await provider.getTransactionReceipt(txHash)

      // parse events, find matching
      const events = validator.parseChannelEventTxReceipt(
        'DidEmptyChannel',
        receipt as any,
        contractAddress,
      )
      assert.isTrue(events.length >= 1)
      assert.isTrue(isBN(events[0].pendingDepositWeiUser))
      assert.containSubset(convertVerboseEvent('str',events[0]), {
        pendingDepositTokenHub: '0',
        pendingDepositTokenUser: '0',
        pendingDepositWeiHub: '0',
        pendingDepositWeiUser: '0',
        threadCount: 0,
        threadRoot: eth.constants.HashZero,
        txCountChain: 2,
        txCountGlobal: 7,
        user: '0x3f1455734de606510c85f10b787b62905fa140ce',
      })


    })

  })
})
