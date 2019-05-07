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
  convertArgs,
  convertChannelRow,
  convertChannelState,
  convertChannelStateUpdateRow,
  convertDeposit,
  convertExchange,
  convertFields,
  convertPayment,
  convertThreadState,
  convertWithdrawal,
  convertWithdrawalParameters,
  ExchangeRates,
  Payment,
  SignedDepositRequestProposal,
  ThreadState,
  UnsignedChannelState,
  UnsignedThreadState,
} from './types'

/*********************************
 *********** UTIL FNS ************
 *********************************/

const { arrayify, isHexString, solidityKeccak256, toUtf8Bytes, verifyMessage } = eth.utils

// Define the utils functions
export class Utils {
  public assetToWei: (fiat: BN, rate: string) => BN[] = bigUtils.assetToWei
  public emptyAddress: string = eth.constants.AddressZero
  public emptyRootHash: string = eth.constants.HashZero
  public getExchangeRates: (state: ConnextState) => ExchangeRates = getters.getExchangeRates
  public maxBN: (a: BN, b: BN) => BN = bigUtils.maxBN
  public minBN: (a: BN, ...b: BN[]) => BN = bigUtils.minBN
  public Poller: any = Poller
  public toWeiBig: (amount: number | string | BN) => BN = bigUtils.toWeiBig
  public toWeiString: (amount: number | string | BN) => string = bigUtils.toWeiString
  public weiToAsset: (wei: BN, rate: string) => BN = bigUtils.weiToAsset
  public convert: any = {
    Args: convertArgs,
    ChannelRow: convertChannelRow,
    ChannelState: convertChannelState,
    ChannelStateUpdateRow: convertChannelStateUpdateRow,
    Deposit: convertDeposit,
    Exchange: convertExchange,
    Fields: convertFields,
    Payment:  convertPayment,
    ThreadState: convertThreadState,
    Withdrawal: convertWithdrawal,
    WithdrawalParameters: convertWithdrawalParameters,
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
          channelState.recipient,
        ],
        [
          channelState.balanceWeiHub,
          channelState.balanceWeiUser,
        ],
        [
          channelState.balanceTokenHub,
          channelState.balanceTokenUser,
        ],
        [
          channelState.pendingDepositWeiHub,
          channelState.pendingWithdrawalWeiHub,
          channelState.pendingDepositWeiUser,
          channelState.pendingWithdrawalWeiUser,
        ],
        [
          channelState.pendingDepositTokenHub,
          channelState.pendingWithdrawalTokenHub,
          channelState.pendingDepositTokenUser,
          channelState.pendingWithdrawalTokenUser,
        ],
        [
          channelState.txCountGlobal,
          channelState.txCountChain,
        ],
        channelState.threadRoot,
        channelState.threadCount,
        channelState.timeout,
      ],
    )
  }

  public createDepositRequestProposalHash(
    req: Payment,
  ): string {
    return solidityKeccak256(
      [
        'uint256',
        'uint256',
      ],
      [
        req.amountToken,
        req.amountWei,
      ],
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
        'uint256',
      ],
      [
        threadState.contractAddress,
        threadState.sender,
        threadState.receiver,
        threadState.threadId,
        [
          threadState.balanceWeiSender,
          threadState.balanceWeiReceiver,
        ],
        [
          threadState.balanceTokenSender,
          threadState.balanceTokenReceiver,
        ],
        threadState.txCount,
      ],
    )
  }

  public generateThreadMerkleTree(
    threadInitialStates: UnsignedThreadState[],
  ): MerkleTree {
    if (threadInitialStates.length === 0) {
      // should this just return emptyRootHash?
      throw new Error('Cannot create a Merkle tree with 0 leaves.')
    }
    let merkle: MerkleTree
    const elems: Buffer[] = threadInitialStates.map((
        threadInitialState: UnsignedThreadState,
      ): Buffer => {
        const hash: string = this.createThreadStateHash(threadInitialState)
        return MerkleUtils.hexToBuffer(hash)
      })
    if (elems.length % 2 !== 0) {
      // cant have odd number of leaves
      elems.push(MerkleUtils.hexToBuffer(this.emptyRootHash))
    }
    merkle = new MerkleTree(elems)
    return merkle
  }

  public generateThreadProof(
    thread: UnsignedThreadState,
    threads: UnsignedThreadState[],
  ): any {
    const hash: string = this.createThreadStateHash(thread)
    const merkle: MerkleTree = this.generateThreadMerkleTree(threads)
    const mproof: any = merkle.proof(MerkleUtils.hexToBuffer(hash))
    let proof: string[] = []
    for (const i of mproof) {
      proof.push(MerkleUtils.bufferToHex(i))
    }
    proof.unshift(hash)
    proof = MerkleUtils.marshallState(proof)
    return proof
  }

  public generateThreadRootHash(
    threadInitialStates: ThreadState[],
  ): string {
    const temp: any[] = []
    let threadRootHash: string
    if (threadInitialStates.length === 0) {
      // reset to initial value -- no open VCs
      threadRootHash = this.emptyRootHash
    } else {
      for (const state of threadInitialStates) {
        temp.push(convertThreadState('str-unsigned', state))
      }
      const merkle: any = this.generateThreadMerkleTree(temp)
      threadRootHash = MerkleUtils.bufferToHex(merkle.getRoot())
    }
    return threadRootHash
  }

  public hasPendingOps(stateAny: ChannelState<any>): boolean {
    const state: any = convertChannelState('str', stateAny)
    for (const field in state) {
      if (!field.startsWith('pending')) {
        continue
      }
      if ((state as any)[field] !== '0') {
        return true
      }
    }
    return false
  }

  public recoverSigner(hash: string, sig: string, signer: string): string | undefined {
    const bytes: Uint8Array = isHexString(hash) ? arrayify(hash) : toUtf8Bytes(hash)
    let recovered: string = verifyMessage(bytes, sig).toLowerCase()
    if (recovered && recovered === signer.toLowerCase()) {
      return recovered
    }
    console.warn(`Signature doesn't match new scheme. Expected ${signer}, Recovered ${recovered}`)
    // For backwards compatibility, TODO: remove until below
    const fingerprint: any = util.toBuffer(String(hash))
    const prefix: any = util.toBuffer('\x19Ethereum Signed Message:\n')
    const prefixedMsg: any = util.keccak256(Buffer.concat(
      [ prefix, util.toBuffer(String(fingerprint.length)), fingerprint ],
    ))
    const res: any = util.fromRpcSig(sig)
    const pubKey: any = util.ecrecover(util.toBuffer(prefixedMsg), res.v, res.r, res.s)
    recovered = util.bufferToHex(util.pubToAddress(pubKey))
    if (recovered && recovered === signer.toLowerCase()) {
      return recovered
    }
    console.warn(`Signature doesn't match old scheme. Expected ${signer}, Recovered ${recovered}`)
    // TODO: remove until here
    return undefined
  }

  public recoverSignerFromChannelState(
    channelState: UnsignedChannelState,
    sig: string,
    signer: string, // who you expect to be the signer
  ): string | undefined {
    const hash: string = this.createChannelStateHash(channelState)
    return this.recoverSigner(hash, sig, signer)
  }

  public recoverSignerFromDepositRequest(
    args: SignedDepositRequestProposal,
    signer: string,
  ): string | undefined {
    const hash: string = this.createDepositRequestProposalHash(args)
    return this.recoverSigner(hash, args.sigUser, signer)
  }

  public recoverSignerFromThreadState(
    threadState: UnsignedThreadState,
    sig: string,
  ): string | undefined {
    const hash: string = this.createThreadStateHash(threadState)
    return this.recoverSigner(hash, sig, threadState.sender)
  }

}
