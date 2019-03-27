import { UnconfirmedTransaction, OnchainTransactionRow } from "../domain/OnchainTransaction";
import { Omit } from "../vendor/connext/types";
import EthereumTx from "ethereumjs-tx"

const Tx = require('ethereumjs-tx')

const Web3 = require('web3')

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
    value: Web3.utils.numberToHex(txn.value),
    gasLimit: Web3.utils.numberToHex(txn.gas),
    gasPrice: Web3.utils.numberToHex(txn.gasPrice),
    data: txn.data,
    nonce: Web3.utils.numberToHex(txn.nonce),
    r: txn.signature && txn.signature.r,
    s: txn.signature && txn.signature.s,
    v: txn.signature && Web3.utils.numberToHex(txn.signature.v),
  })
}

/**
 * Converts an UnconfirmedTransaction to an instance of Tx from ethereumjs-tx
 */
export function onchainTxnToRawTx(txn: OnchainTransactionRow): EthereumTx {
  return new Tx({
    from: txn.from,
    to: txn.to,
    value: Web3.utils.numberToHex(txn.value),
    gasLimit: Web3.utils.numberToHex(txn.gas),
    gasPrice: Web3.utils.numberToHex(txn.gasPrice),
    data: txn.data,
    nonce: Web3.utils.numberToHex(txn.nonce),
  })
}