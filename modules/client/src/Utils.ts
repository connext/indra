import util from 'ethereumjs-util'
import { ethers as eth } from 'ethers'
import { BigNumber as BN } from 'ethers/utils'

import * as bigUtils from './lib/bn'
import MerkleTree from './lib/merkleTree'
import { MerkleUtils } from './lib/merkleUtils'
import { Poller } from './lib/poller/Poller'
import * as getters from './state/getters'
import { ConnextState } from './state/store'
import {
  ChannelState,
  convertChannelState,
  convertThreadState,
  Payment,
  SignedDepositRequestProposal,
  ThreadState,
  UnsignedChannelState,
  UnsignedThreadState,
} from './types'

/*********************************
 *********** UTIL FNS ************
 *********************************/

const { arrayify, isHexString, solidityKeccak256, toUtf8Bytes, verifyMessage, } = eth.utils

// define the utils functions
export class Utils {
  public emptyAddress = eth.constants.AddressZero
  public emptyRootHash = eth.constants.HashZero
  public getExchangeRates = getters.getExchangeRates
  public Poller = Poller
  public assetToWei = bigUtils.assetToWei
  public maxBN = bigUtils.maxBN
  public minBN = bigUtils.minBN
  public toWeiBig = bigUtils.toWeiBig
  public toWeiString = bigUtils.toWeiString
  public weiToAsset = bigUtils.weiToAsset

  public hasPendingOps(stateAny: ChannelState<any>) {
    const state = convertChannelState('str', stateAny)
    for (let field in state) {
      if (!field.startsWith('pending'))
        continue
      if ((state as any)[field] !== '0')
        return true
    }
    return false
  }

  public createDepositRequestProposalHash(
    req: Payment,
  ): string {
    return solidityKeccak256(
      [
        'uint256',
        'uint256'
      ],
      [
        req.amountToken,
        req.amountWei
      ]
    )
  }

  public createChannelStateHash(
    channelState: UnsignedChannelState,
  ): string {
    return solidityKeccak256(
      [
        'address',
        'address[2]',
        'uint256[2]',
        'uint256[2]',
        'uint256[4]',
        'uint256[4]',
        'uint256[2]',
        'bytes32',
        'uint256',
        'uint256',
      ],
      [
        channelState.contractAddress,
        [
          channelState.user,
          channelState.recipient
        ], [
          channelState.balanceWeiHub,
          channelState.balanceWeiUser
        ], [
          channelState.balanceTokenHub,
          channelState.balanceTokenUser
        ], [
          channelState.pendingDepositWeiHub,
          channelState.pendingWithdrawalWeiHub,
          channelState.pendingDepositWeiUser,
          channelState.pendingWithdrawalWeiUser,
        ], [
          channelState.pendingDepositTokenHub,
          channelState.pendingWithdrawalTokenHub,
          channelState.pendingDepositTokenUser,
          channelState.pendingWithdrawalTokenUser,
        ], [
          channelState.txCountGlobal,
          channelState.txCountChain
        ],
        channelState.threadRoot,
        channelState.threadCount,
        channelState.timeout,
      ]
    )
  }

  public createThreadStateHash(threadState: UnsignedThreadState): string {
    return solidityKeccak256(
      [
        'address',
        'address',
        'address',
        'uint256',
        'uint256[2]',
        'uint256[2]',
        'uint256'
      ],
      [
        threadState.contractAddress,
        threadState.sender,
        threadState.receiver,
        threadState.threadId,
        [
          threadState.balanceWeiSender,
          threadState.balanceWeiReceiver
        ], [
          threadState.balanceTokenSender,
          threadState.balanceTokenReceiver
        ],
        threadState.txCount
      ]
    )
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

  public recoverSigner(hash: string, sig: string, signer: string) {
    const bytes = isHexString(hash) ? arrayify(hash) : toUtf8Bytes(hash)
    let recovered = verifyMessage(bytes, sig).toLowerCase()
    if (recovered && recovered !== signer.toLowerCase()) {
      return recovered
    }
    console.warn(`Signature doesn't match new scheme. Expected ${signer}, Recovered ${recovered}`)
    // For backwards compatibility, TODO: remove until below
    const fingerprint = util.toBuffer(String(hash))
    const prefix = util.toBuffer('\x19Ethereum Signed Message:\n')
    const prefixedMsg = util.keccak256(Buffer.concat(
      [ prefix, util.toBuffer(String(fingerprint.length)), fingerprint ]
    ))
    const res = util.fromRpcSig(sig)
    const pubKey = util.ecrecover( util.toBuffer(prefixedMsg), res.v, res.r, res.s,)
    recovered = util.bufferToHex(util.pubToAddress(pubKey))
    if (recovered && recovered !== signer.toLowerCase()) {
      return recovered
    }
    console.warn(`Signature doesn't match old scheme. Expected ${signer}, Recovered ${recovered}`)
    // TODO: remove until here
    return null
  }

  public recoverSignerFromDepositRequest(
    args: SignedDepositRequestProposal,
    signer: string,
  ): string | null {
    const hash = this.createDepositRequestProposalHash(args)
    return this.recoverSigner(hash, args.sigUser, signer)
  }

  public recoverSignerFromChannelState(
    channelState: UnsignedChannelState,
    sig: string,
    signer: "user" | "hub",
  ): string | null {
    const hash: any = this.createChannelStateHash(channelState)
    const signerAddress = signer == "user" ? channelState.user : channelState.recipient
    return this.recoverSigner(hash, sig, signerAddress)
  }

  public recoverSignerFromThreadState(
    threadState: UnsignedThreadState,
    sig: string,
  ): string | null {
    // console.log('recovering signer from state:', threadState)
    const hash: any = this.createThreadStateHash(threadState)
    return this.recoverSigner(hash, sig, threadState.sender)
  }

  public generateThreadRootHash(
    threadInitialStates: ThreadState[],
  ): string {
    let temp = []
    let threadRootHash
    if (threadInitialStates.length === 0) {
      // reset to initial value -- no open VCs
      threadRootHash = this.emptyRootHash
    } else {
      for(let i = 0; i < threadInitialStates.length; i++) {
        temp[i] = convertThreadState("str-unsigned", threadInitialStates[i])
      }
      const merkle = this.generateThreadMerkleTree(temp)
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

}
