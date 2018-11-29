import { LedgerChannelDto, LcStateUpdateDto } from '../domain/LedgerChannel'
import {
  VirtualChannelDto,
  VcStateUpdateDto,
  VirtualChannel,
} from '../domain/VirtualChannel'
import Connext = require('connext')
const Web3 = require('web3')

export function generateVcRootHash(vcInitialStates: VirtualChannel[]): string {
  const vc0s = vcInitialStates.map(e => ({
    ...e,
    vcId: e.channelId,
    subchanAI: e.subchanAtoI,
    subchanBI: e.subchanBtoI,
  }))
  const vcRootHash = Connext.generateThreadRootHash({
    threadInitialStates: vc0s as any,
  })
  return vcRootHash
}

export function createLcUpdateFingerprint(
  lc: LedgerChannelDto,
  update: LcStateUpdateDto,
): string {
  const {
    nonce,
    openVcs,
    vcRootHash,
    ethBalanceA,
    ethBalanceI,
    tokenBalanceA,
    tokenBalanceI,
    isClose,
  } = update
  const { partyA, partyI, channelId } = lc
  const fingerprint = Connext.createChannelStateUpdateFingerprint({
    isClose,
    channelId,
    nonce,
    numOpenThread: openVcs,
    threadRootHash: vcRootHash,
    partyA,
    partyI,
    weiBalanceA: Web3.utils.toBN(ethBalanceA),
    weiBalanceI: Web3.utils.toBN(ethBalanceI),
    tokenBalanceA: Web3.utils.toBN(tokenBalanceA),
    tokenBalanceI: Web3.utils.toBN(tokenBalanceI),
  })
  return fingerprint
}

export async function signLcUpdate(
  lc: LedgerChannelDto,
  update: LcStateUpdateDto,
  web3: any,
): Promise<string> {
  const [myAccount] = await web3.eth.getAccounts()
  const fingerprint = createLcUpdateFingerprint(lc, update)
  // sign
  return web3.eth.sign(fingerprint, myAccount)
}

export function verifyLcUpdate(
  lc: LedgerChannelDto,
  update: LcStateUpdateDto,
  sig: string,
  signer: string,
): boolean {
  console.log({
    sig,
    isClose: update.isClose,
    channelId: lc.channelId,
    nonce: update.nonce,
    openVcs: update.openVcs,
    vcRootHash: update.vcRootHash,
    partyA: lc.partyA,
    partyI: lc.partyI,
    ethBalanceA: Web3.utils.toBN(update.ethBalanceA),
    ethBalanceI: Web3.utils.toBN(update.ethBalanceI),
    tokenBalanceA: Web3.utils.toBN(update.tokenBalanceA),
    tokenBalanceI: Web3.utils.toBN(update.tokenBalanceI),
  })
  const recoveredSigner = Connext.recoverSignerFromChannelState({
    sig,
    isClose: update.isClose,
    channelId: lc.channelId,
    nonce: update.nonce,
    numOpenThread: update.openVcs,
    threadRootHash: update.vcRootHash,
    partyA: lc.partyA,
    partyI: lc.partyI,
    weiBalanceA: Web3.utils.toBN(update.ethBalanceA),
    weiBalanceI: Web3.utils.toBN(update.ethBalanceI),
    tokenBalanceA: Web3.utils.toBN(update.tokenBalanceA),
    tokenBalanceI: Web3.utils.toBN(update.tokenBalanceI),
  })
  console.log('recoveredSigner: ', recoveredSigner, '(expected:', signer + ')')
  return recoveredSigner === signer
}

export function createVcUpdateFingerprint(
  vc: VirtualChannelDto,
  update: VcStateUpdateDto,
): string {
  const { partyA, channelId, partyB } = vc
  const {
    ethBalanceA,
    ethBalanceB,
    tokenBalanceA,
    tokenBalanceB,
    nonce,
  } = update

  const fingerprint = Connext.createThreadStateUpdateFingerprint({
    channelId,
    nonce,
    partyA,
    partyB,
    weiBalanceA: Web3.utils.toBN(ethBalanceA),
    weiBalanceB: Web3.utils.toBN(ethBalanceB),
    tokenBalanceA: Web3.utils.toBN(tokenBalanceA),
    tokenBalanceB: Web3.utils.toBN(tokenBalanceB),
    weiBond: Web3.utils.toBN(0),
    tokenBond: Web3.utils.toBN(0),
  })
  return fingerprint
}

export function verifyVcUpdateSig(
  vc: VirtualChannelDto,
  update: VcStateUpdateDto,
  sig: string,
  signer: string,
): boolean {
  const { partyA: vcPartyA, partyB: vcPartyB, channelId } = vc

  const {
    ethBalanceA,
    ethBalanceB,
    tokenBalanceA,
    tokenBalanceB,
    nonce,
  } = update

  console.log({
    sig,
    channelId,
    nonce,
    partyA: vcPartyA,
    partyB: vcPartyB,
    ethBalanceA: Web3.utils.toBN(ethBalanceA),
    ethBalanceB: Web3.utils.toBN(ethBalanceB),
    tokenBalanceA: Web3.utils.toBN(tokenBalanceA),
    tokenBalanceB: Web3.utils.toBN(tokenBalanceB),
  })
  const recoveredSigner = Connext.recoverSignerFromThreadState({
    sig,
    channelId,
    nonce,
    partyA: vcPartyA,
    partyB: vcPartyB,
    weiBalanceA: Web3.utils.toBN(ethBalanceA),
    weiBalanceB: Web3.utils.toBN(ethBalanceB),
    tokenBalanceA: Web3.utils.toBN(tokenBalanceA),
    tokenBalanceB: Web3.utils.toBN(tokenBalanceB),
    weiBond: Web3.utils.toBN(0),
    tokenBond: Web3.utils.toBN(0),
  })
  console.log('recoveredSigner: ', recoveredSigner)
  return recoveredSigner === signer
}
