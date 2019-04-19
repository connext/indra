import util = require('ethereumjs-util')
import { ethers as eth } from 'ethers';
import MerkleTree from './helpers/merkleTree';
import { MerkleUtils } from './helpers/merkleUtils';
import { Poller } from './lib/poller/Poller';
import * as getters from './state/getters';
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

export const emptyAddress = eth.constants.AddressZero
export const emptyRootHash = eth.constants.HashZero

// define the utils functions
export class Utils {
  emptyAddress = eth.constants.AddressZero
  emptyRootHash = eth.constants.HashZero
  getters = getters
  Poller = Poller

  public createDepositRequestProposalHash(
    req: Payment,
  ): string {
    const { amountToken, amountWei } = req
    const hash = eth.utils.solidityKeccak256(
      [ 'uint256', 'uint256' ],
      [ amountToken, amountWei ]
    )
    return hash
  }

  public recoverSignerFromDepositRequest(
    args: SignedDepositRequestProposal,
  ): string {
    const hash = this.createDepositRequestProposalHash(args)
    return this.recoverSigner(hash, args.sigUser)
  }

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
    const hash = eth.utils.solidityKeccak256(
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
        'uint256'
      ],
      [
        contractAddress,
        [ user, recipient ],
        [ balanceWeiHub, balanceWeiUser ],
        [ balanceTokenHub, balanceTokenUser ],
        [
          pendingDepositWeiHub,
          pendingWithdrawalWeiHub,
          pendingDepositWeiUser,
          pendingWithdrawalWeiUser,
        ],
        [
          pendingDepositTokenHub,
          pendingWithdrawalTokenHub,
          pendingDepositTokenUser,
          pendingWithdrawalTokenUser,
          ],
        [ txCountGlobal, txCountChain ],
        threadRoot,
        threadCount,
        timeout
      ]
    )
    return hash
  }

  public recoverSignerFromChannelState(
    channelState: UnsignedChannelState,
    // could be hub or user
    sig: string,
  ): string {
    const hash: any = this.createChannelStateHash(channelState)
    return this.recoverSigner(hash, sig)
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
    const hash = eth.utils.solidityKeccak256(
      [ 'address', 'address', 'address', 'uint256', 'uint256[2]', 'uint256[2]', 'uint256' ],
      [ contractAddress, sender, receiver, threadId, [balanceWeiSender, balanceWeiReceiver], [balanceTokenSender, balanceTokenReceiver], txCount ]
    )
    return hash
  }

  public recoverSignerFromThreadState(
    threadState: UnsignedThreadState,
    sig: string,
  ): string {
    // console.log('recovering signer from state:', threadState)
    const hash: any = this.createThreadStateHash(threadState)
    return this.recoverSigner(hash, sig)
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

  private recoverSigner(hash: string, sig: string) {
    // let fingerprint: any = this.createChannelStateHash(channelState)
    let fingerprint = util.toBuffer(String(hash))
    const prefix = util.toBuffer('\x19Ethereum Signed Message:\n')
    // @ts-ignore
    const prefixedMsg = util.keccak256(
      // @ts-ignore
      Buffer.concat([
        // @ts-ignore
        prefix,
        // @ts-ignore
        util.toBuffer(String(fingerprint.length)),
        // @ts-ignore
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
    // console.log('recovered:', addr)

    return addr
  }

  hasPendingOps(stateAny: ChannelState<any>) {
    const state = convertChannelState('str', stateAny)
    for (let field in state) {
      if (!field.startsWith('pending'))
        continue
      if ((state as any)[field] !== '0')
        return true
    }
    return false
  }

}
