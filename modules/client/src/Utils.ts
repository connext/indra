/*********************************
 *********** UTIL FNS ************
 *********************************/
import util = require('ethereumjs-util')
import { MerkleUtils } from './helpers/merkleUtils'
import MerkleTree from './helpers/merkleTree'
import Web3 = require('web3')

import {
  UnsignedChannelState,
  UnsignedThreadState,
} from './types'

// import types from connext

export const emptyAddress = '0x0000000000000000000000000000000000000000'
export const emptyRootHash = '0x0000000000000000000000000000000000000000000000000000000000000000'

// define the utils functions
export class Utils {
  emptyAddress = '0x0000000000000000000000000000000000000000'
  emptyRootHash = '0x0000000000000000000000000000000000000000000000000000000000000000'

  public createChannelStateHash(
    channelState: UnsignedChannelState,
  ): string {
    const {
      contractAddress,
      user,
      recipient,
      balanceWeiHub,
      balanceWeiUser,
      balanceTokenHub,
      balanceTokenUser,
      pendingDepositWeiHub,
      pendingDepositWeiUser,
      pendingDepositTokenHub,
      pendingDepositTokenUser,
      pendingWithdrawalWeiHub,
      pendingWithdrawalWeiUser,
      pendingWithdrawalTokenHub,
      pendingWithdrawalTokenUser,
      txCountGlobal,
      txCountChain,
      threadRoot,
      threadCount,
      timeout,
    } = channelState

    // hash data
    // @ts-ignore
    const hash = Web3.utils.soliditySha3(
      { type: 'address', value: contractAddress },
      // @ts-ignore TODO wtf??!
      { type: 'address[2]', value: [user, recipient] },
      {
        type: 'uint256[2]',
        value: [balanceWeiHub, balanceWeiUser],
      },
      {
        type: 'uint256[2]',
        value: [balanceTokenHub, balanceTokenUser],
      },
      {
        type: 'uint256[4]',
        value: [
          pendingDepositWeiHub,
          pendingWithdrawalWeiHub,
          pendingDepositWeiUser,
          pendingWithdrawalWeiUser,
        ],
      },
      {
        type: 'uint256[4]',
        value: [
          pendingDepositTokenHub,
          pendingWithdrawalTokenHub,
          pendingDepositTokenUser,
          pendingWithdrawalTokenUser,
        ],
      },
      {
        type: 'uint256[2]',
        value: [txCountGlobal, txCountChain],
      },
      { type: 'bytes32', value: threadRoot },
      { type: 'uint256', value: threadCount },
      { type: 'uint256', value: timeout },
    )
    return hash
  }

  public recoverSignerFromChannelState(
    channelState: UnsignedChannelState,
    // could be hub or user
    sig: string,
  ): string {
    let fingerprint: any = this.createChannelStateHash(channelState)
    fingerprint = util.toBuffer(String(fingerprint))
    const prefix = util.toBuffer('\x19Ethereum Signed Message:\n')
    // @ts-ignore
    const prefixedMsg = util.keccak256(
      // @ts-ignore
      Buffer.concat([
        prefix,
        util.toBuffer(String(fingerprint.length)),
        fingerprint,
      ]),
    )
    const res = util.fromRpcSig(sig)
    const pubKey = util.ecrecover(
      util.toBuffer(prefixedMsg),
      res.v,
      res.r,
      res.s,
    )
    const addrBuf = util.pubToAddress(pubKey)
    const addr = util.bufferToHex(addrBuf)
    console.log('recovered:', addr)

    return addr
  }

  public createThreadStateHash(threadState: UnsignedThreadState): string {
    const {
      contractAddress,
      sender,
      receiver,
      threadId,
      balanceWeiSender,
      balanceWeiReceiver,
      balanceTokenSender,
      balanceTokenReceiver,
      txCount,
    } = threadState
    // convert ChannelState to UnsignedChannelState
    // @ts-ignore
    const hash = Web3.utils.soliditySha3(
      { type: 'address', value: contractAddress },
      { type: 'address', value: sender },
      { type: 'address', value: receiver },
      // @ts-ignore TODO wtf??!
      { type: 'uint256', value: threadId },
      {
        type: 'uint256',
        value: [balanceWeiSender, balanceWeiReceiver],
      },
      {
        type: 'uint256',
        value: [balanceTokenSender, balanceTokenReceiver],
      },
      { type: 'uint256', value: txCount },
    )
    return hash
  }

  public recoverSignerFromThreadState(
    threadState: UnsignedThreadState,
    sig: string,
  ): string {
    let fingerprint: any = this.createThreadStateHash(threadState)
    fingerprint = util.toBuffer(String(fingerprint))
    const prefix = util.toBuffer('\x19Ethereum Signed Message:\n')
    // @ts-ignore
    const prefixedMsg = util.keccak256(
      // @ts-ignore
      Buffer.concat([
        prefix,
        util.toBuffer(String(fingerprint.length)),
        fingerprint,
      ]),
    )
    const res = util.fromRpcSig(sig)
    const pubKey = util.ecrecover(prefixedMsg, res.v, res.r, res.s)
    const addrBuf = util.pubToAddress(pubKey)
    const addr = util.bufferToHex(addrBuf)
    console.log('recovered:', addr)

    return addr
  }

  public generateThreadMerkleTree(
    threadInitialStates: UnsignedThreadState[],
  ): any {
    // TO DO: should this just return emptyRootHash?
    if (threadInitialStates.length === 0) {
      throw new Error('Cannot create a Merkle tree with 0 leaves.')
    }
    let merkle
    let elems = threadInitialStates.map(threadInitialState => {
      // hash each initial state and convert hash to buffer
      const hash = this.createThreadStateHash(threadInitialState)
      const buf = MerkleUtils.hexToBuffer(hash)
      return buf
    })
    if (elems.length % 2 !== 0) {
      // cant have odd number of leaves
      elems.push(MerkleUtils.hexToBuffer(this.emptyRootHash))
    }
    merkle = new MerkleTree(elems)

    return merkle
  }

  public generateThreadRootHash(
    threadInitialStates: UnsignedThreadState[],
  ): string {
    let threadRootHash
    if (threadInitialStates.length === 0) {
      // reset to initial value -- no open VCs
      threadRootHash = this.emptyRootHash
    } else {
      const merkle = this.generateThreadMerkleTree(threadInitialStates)
      threadRootHash = MerkleUtils.bufferToHex(merkle.getRoot())
    }

    return threadRootHash
  }

  public generateThreadProof(
    thread: UnsignedThreadState,
    threads: UnsignedThreadState[],
  ): any {
    // generate hash
    const hash = this.createThreadStateHash(thread)
    // generate merkle tree
    let merkle = this.generateThreadMerkleTree(threads)
    let mproof = merkle.proof(MerkleUtils.hexToBuffer(hash))

    let proof = []
    for (var i = 0; i < mproof.length; i++) {
      proof.push(MerkleUtils.bufferToHex(mproof[i]))
    }

    proof.unshift(hash)

    proof = MerkleUtils.marshallState(proof)
    return proof
  }

  public threadIsContained(
    threadHash: string,
    // TO DO: can we not pass in the thread array?
    threads: UnsignedThreadState[],
    threadMerkleRoot: string,
    proof: any,
  ) {
    // TO DO: implement without rebuilding the thread tree?
    // otherwise you will have to pass in threads to each one
    // solidity code to satisfy:
    //   function _isContained(bytes32 _hash, bytes _proof, bytes32 _root) internal pure returns (bool) {
    //     bytes32 cursor = _hash;
    //     bytes32 proofElem;
    //     for (uint256 i = 64; i <= _proof.length; i += 32) {
    //         assembly { proofElem := mload(add(_proof, i)) }
    //         if (cursor < proofElem) {
    //             cursor = keccak256(abi.encodePacked(cursor, proofElem));
    //         } else {
    //             cursor = keccak256(abi.encodePacked(proofElem, cursor));
    //         }
    //     }
    //     return cursor == _root;
    // }
    // generate merkle tree
    const mtree = this.generateThreadMerkleTree(threads)
    if (mtree.getRoot() !== threadMerkleRoot) {
      throw new Error(`Incorrect root provided`)
    }
    return mtree.verify(proof, threadHash)
  }
}
