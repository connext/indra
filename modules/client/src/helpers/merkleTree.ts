const util: any = require('ethereumjs-util')
import { MerkleUtils } from './merkleUtils'

function combinedHash(first: any, second: any) {
  if (!second) {
    return first
  }
  if (!first) {
    return second
  }
  // @ts-ignore
  let sorted = Buffer.concat([first, second].sort(Buffer.compare))

  // @ts-ignore
  return (util as any).keccak256(sorted)
}

function deduplicate(buffers: any[]) {
  return buffers.filter((buffer, i) => {
    return buffers.findIndex(e => e.equals(buffer)) === i
  })
}

function getPair(index: number, layer: any) {
  let pairIndex = index % 2 ? index - 1 : index + 1
  if (pairIndex < layer.length) {
    return layer[pairIndex]
  } else {
    return null
  }
}

function getLayers(elements: any) {
  if (elements.length === 0) {
    return [[Buffer.from('')]]
  }
  let layers = []
  layers.push(elements)
  while (layers[layers.length - 1].length > 1) {
    layers.push(getNextLayer(layers[layers.length - 1]))
  }
  return layers
}

function getNextLayer(elements: any[]) {
  return elements.reduce((layer, element, index, arr) => {
    if (index % 2 === 0) {
      layer.push(combinedHash(element, arr[index + 1]))
    }
    return layer
  }, [])
}

export default class MerkleTree {
  elements: any
  root: any
  layers: any

  constructor(_elements: any) {
    if (!_elements.every(MerkleUtils.isHash)) {
      throw new Error('elements must be 32 byte buffers')
    }
    const e = { elements: deduplicate(_elements) }
    Object.assign(this, e)
    this.elements.sort(Buffer.compare)

    const l = { layers: getLayers(this.elements) }
    Object.assign(this, l)
  }

  getRoot() {
    if (!this.root) {
      let r = { root: this.layers[this.layers.length - 1][0] }
      Object.assign(this, r)
    }
    return this.root
  }

  verify(proof: any, element: any) {
    return this.root.equals(
      proof.reduce((hash: any, pair: any) => combinedHash(hash, pair), element),
    )
  }

  proof(element: any) {
    let index = this.elements.findIndex((e: any) => e.equals(element))

    if (index === -1) {
      throw new Error('element not found in merkle tree')
    }

    return this.layers.reduce((proof: any, layer: any) => {
      let pair = getPair(index, layer)
      if (pair) {
        proof.push(pair)
      }
      index = Math.floor(index / 2)
      return proof
    }, [])
  }
}
