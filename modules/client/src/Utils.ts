import { ethers as eth } from 'ethers'

import { getCustodialAndChannelBalance } from './lib/getBalances'
import { MerkleTree } from './lib/merkleTree'
import * as getters from './state/getters'
import { ConnextState } from './state/store'
import {
  channelNumericFields,
  ChannelState,
  convert,
  ExchangeRates,
  Payment,
  SignedDepositRequestProposal,
  ThreadState,
  UnsignedChannelState,
  UnsignedThreadState,
} from './types'

const { arrayify, isHexString, solidityKeccak256, toUtf8Bytes, verifyMessage } = eth.utils

////////////////////////////////////////
// Begin Utils class definition

export class Utils {
  public channelNumericFields: string[] = channelNumericFields
  public getExchangeRates: (state: ConnextState) => ExchangeRates = getters.getExchangeRates
  public getCustodialAndChannelBalance: (state: ConnextState) => Payment =
    getCustodialAndChannelBalance

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

  public generateThreadProof(
    thread: UnsignedThreadState,
    threads: UnsignedThreadState[],
  ): string {
    const hash: string = this.createThreadStateHash(thread)
    const hashes: string[] = threads.map(this.createThreadStateHash)
    return (new MerkleTree(hashes)).proof(hash)
  }

  public verifyThreadProof(
    proof: string,
    threads: UnsignedThreadState[],
  ): boolean {
    return (new MerkleTree(threads.map(this.createThreadStateHash))).verify(proof)
  }

  public generateThreadRootHash(threadInitialStates: ThreadState[]): string {
    const hashes: string[] = threadInitialStates.map((thread: ThreadState): string =>
      this.createThreadStateHash(convert.ThreadState('str-unsigned', thread)),
    )
    return (new MerkleTree(hashes)).root
  }

  public hasPendingOps(stateAny: ChannelState<any>): boolean {
    const state: ChannelState = convert.ChannelState('str', stateAny)
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
    const recovered: string = verifyMessage(bytes, sig).toLowerCase()
    if (recovered && recovered === signer.toLowerCase()) {
      return recovered
    }
    return undefined
  }

  public recoverSignerFromChannelState(
    channelState: UnsignedChannelState,
    sig: string,
    expectedSigner: string,
  ): string | undefined {
    return this.recoverSigner(
      this.createChannelStateHash(channelState),
      sig,
      expectedSigner,
    )
  }

  public recoverSignerFromDepositRequest(
    args: SignedDepositRequestProposal,
    expectedSigner: string,
  ): string | undefined {
    return this.recoverSigner(
      this.createDepositRequestProposalHash(args),
      args.sigUser,
      expectedSigner,
    )
  }

  public recoverSignerFromThreadState(
    threadState: UnsignedThreadState,
    sig: string,
  ): string | undefined {
    return this.recoverSigner(
      this.createThreadStateHash(threadState),
      sig,
      threadState.sender,
    )
  }

}
