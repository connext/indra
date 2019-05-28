import * as connext from 'connext'
import { Omit } from 'connext/types'
import EthereumTx from 'ethereumjs-tx'
import * as eth from 'ethers'
const Tx = require('ethereumjs-tx')

import {
  OnchainTransactionRow,
  RawTransaction,
  UnconfirmedTransaction
} from '../domain/OnchainTransaction'

const toHex = (n: string|number) => eth.utils.bigNumberify(n).toHexString()

/**
 * Serializes a transaction to a raw string.
 */
export function serializeTxn(txn: Omit<UnconfirmedTransaction, 'hash'>): string {
  const tx = txnToTx(txn)
  return '0x' + tx.serialize().toString('hex')
}

/**
 * Generates hash from tx.
 */
export function generateHash(txn: Omit<UnconfirmedTransaction, 'hash'>, includeSig: boolean = true): string {
  const tx = txnToTx(txn)
  return '0x' + tx.hash(includeSig).toString('hex')
}

/**
 * Converts an UnconfirmedTransaction to an instance of Tx from ethereumjs-tx
 */
export function txnToTx(txn: Omit<UnconfirmedTransaction, 'hash'>): EthereumTx {
  return new Tx({
    from: txn.from,
    to: txn.to,
    value: toHex(txn.value),
    gasLimit: toHex(txn.gas),
    gasPrice: toHex(txn.gasPrice),
    data: txn.data,
    nonce: toHex(txn.nonce),
    r: txn.signature && txn.signature.r,
    s: txn.signature && txn.signature.s,
    v: txn.signature && toHex(txn.signature.v),
  })
}

/**
 * Converts a RawTransaction to an instance of Tx from ethereumjs-tx
 */
export function rawTxnToTx(txn: RawTransaction): EthereumTx {
  return new Tx({
    from: txn.from,
    to: txn.to,
    value: toHex(txn.value),
    gasLimit: toHex(txn.gas),
    gasPrice: toHex(txn.gasPrice),
    data: txn.data,
    nonce: toHex(txn.nonce),
  })
}

/**
 * Converts an UnconfirmedTransaction to an instance of Tx from ethereumjs-tx
 */
export function onchainTxnToRawTx(txn: OnchainTransactionRow): EthereumTx {
  return new Tx({
    from: txn.from,
    to: txn.to,
    value: toHex(txn.value),
    gasLimit: toHex(txn.gas),
    gasPrice: toHex(txn.gasPrice),
    data: txn.data,
    nonce: toHex(txn.nonce),
  })
}
