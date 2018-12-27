import { BigNumber } from 'bignumber.js'
import requestJson from './request';

export const Subprovider = require('web3-provider-engine/subproviders/subprovider')

const hubUrl = process.env.REACT_APP_HUB_URL

const GWEI = new BigNumber('1e9')
const MAX_PRICE = GWEI.times(50)

interface Transaction {
  gasPrice: string
}

export default class GaspriceSubprovider extends Subprovider {
  handleRequest(payload: any, next: () => void, end: (err: any, res?: any) => void) {
    if (payload.method !== 'gas-estimate-latest') {
      return next()
    }

    this.estimateGasPriceFromHub()
      .catch(err => {
        console.warn('Error fetching gas price from the hub (falling back to Web3):', err)
        return null
      })
      .then(gasPrice => {
        if (!gasPrice)
          return this.estimateGasPriceFromPreviousBlocks()
        return gasPrice
      })
      .then(
        gasPrice => end(null, `0x${gasPrice.toString(16)}`),
        err => end(err)
      )
  }

  private async estimateGasPriceFromHub (): Promise<BigNumber | null> {
    const res = await requestJson<any>(`${hubUrl}/gasPrice/estimate`)
    if (res && res.gasPrice) {
      return new BigNumber(res.gasPrice).times(GWEI)
    }

    return null
  }

  private estimateGasPriceFromPreviousBlocks (): Promise<BigNumber> {
    return new Promise((resolve, reject) => {
      this.emitPayload({ method: 'eth_blockNumber'}, (err: any, res: any) => {
        let lastBlock = new BigNumber(res.result)
        const blockNums = []

        for (let i = 0; i < 10; i++) {
          blockNums.push(`0x${lastBlock.toString(16)}`)
          lastBlock = lastBlock.minus(1)
        }

        const gets = blockNums.map((item: string) => this.getBlock(item))

        Promise.all(gets)
          .then((blocks: Transaction[][]) => {
            resolve(BigNumber.min(this.meanGasPrice(blocks), MAX_PRICE))
          })
          .catch(reject)
      })
    })
  }

  private getBlock (item: string): Promise<Transaction[]> {
    return new Promise((resolve, reject) => this.emitPayload({ method: 'eth_getBlockByNumber', params: [ item, true ] }, (err: any, res: any) => {
      if (err) {
        return reject(err)
      }

      if (!res.result) {
        return resolve([])
      }

      resolve(res.result.transactions)
    }))
  }

  private meanGasPrice(blocks: Transaction[][]): BigNumber {
    let sum = new BigNumber(0)
    let count = 0

    for (let i = 0; i < blocks.length; i++) {
      const txns = blocks[i]

      for (let j = 0; j < txns.length; j++) {
        const currPrice = new BigNumber(txns[j].gasPrice)
        sum = sum.plus(currPrice)
        count++
      }
    }

    return sum.dividedBy(count)
  }
}
