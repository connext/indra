import { ethers as eth } from 'ethers'
import { MerkleUtils } from './merkleUtils'

const { keccak256 } = eth.utils

function combinedHash(first: Buffer, second: Buffer): Buffer {
  if (!second) { return first }
  if (!first) { return second }
  // @ts-ignore
  const sorted: Buffer = Buffer.concat([first, second].sort(Buffer.compare))
  return Buffer.from(keccak256('0x' + sorted.toString('hex')))
}

function deduplicate(buffers: Buffer[]): Buffer[] {
  return buffers.filter((buffer: Buffer, i: number): boolean => {
    return buffers.findIndex((e: Buffer): boolean => e.equals(buffer)) === i
  })
}

function getPair(index: number, layer: any): any {
  const pairIndex: number = index % 2 ? index - 1 : index + 1
  if (pairIndex < layer.length) {
    return layer[pairIndex]
  } else {
    return null
  }
}

function getNextLayer(elements: any[]): any {
  return elements.reduce((layer: any, element: any, index: number, arr: any[]) => {
    if (index % 2 === 0) {
      layer.push(combinedHash(element, arr[index + 1]))
    }
    return layer
  }, [])
}

function getLayers(elements: any): any {
  if (elements.length === 0) {
    return [[Buffer.from('')]]
  }
  const layers: any[] = []
  layers.push(elements)
  while (layers[layers.length - 1].length > 1) {
    layers.push(getNextLayer(layers[layers.length - 1]))
  }
  return layers
}

export default class MerkleTree {
  public elements: any
  public root: any
  public layers: any

  constructor(_elements: Buffer[]) {
    if (!_elements.every(MerkleUtils.isHash)) {
      throw new Error('elements must be 32 byte buffers')
    }
    const e = { elements: deduplicate(_elements) }
    Object.assign(this, e)
    this.elements.sort(Buffer.compare)
    const l = { layers: getLayers(this.elements) }
    Object.assign(this, l)
  }

  public getRoot(): any {
    if (!this.root) {
      const r = { root: this.layers[this.layers.length - 1][0] }
      Object.assign(this, r)
    }
    return this.root
  }

  public verify(proof: any, element: any): any {
    return this.root.equals(
      proof.reduce((hash: any, pair: any) => combinedHash(hash, pair), element),
    )
  }

  public proof(element: any): any {
    let index = this.elements.findIndex((e: any) => e.equals(element))
    if (index === -1) { throw new Error('element not found in merkle tree') }
    return this.layers.reduce((proof: any, layer: any) => {
      const pair = getPair(index, layer)
      if (pair) { proof.push(pair) }
      index = Math.floor(index / 2)
      return proof
    }, [])
  }

}
