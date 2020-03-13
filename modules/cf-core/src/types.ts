import {
  CFCoreTypes,
  ILoggerService,
  NetworkContext,
  ProtocolMessage,
  SolidityValueType,
} from "@connext/types";
import { BaseProvider } from "ethers/providers";
import { Signature } from "ethers/utils";

import { Opcode } from "./machine";
import { Store } from "./store";

export abstract class EthereumCommitment {
  // todo(xuanji): EthereumCommitment was designed under the assumption that
  // `hashToSign` returns the same hash for different signers. However, in the
  // install-virtual-app protocol, the hash that the intermediary signs is
  // different from the one the other participants sign. The optional
  // `signerIsIntermediary` flag is a hack that is only used by the
  // `install-virtual-app protocol`. `intermediarySignature` in `transaction`
  // is the same kind of hack.
  public abstract hashToSign(signerIsIntermediary?: boolean): string;
  public abstract getSignedTransaction(
    signatures: Signature[],
    intermediarySignature?: Signature,
  ): CFCoreTypes.MinimalTransaction;
}

export enum MultisigOperation {
  Call = 0,
  DelegateCall = 1,
  // Gnosis Safe uses "2" for CREATE, but we don't actually
  // make use of it in our code. Still, I put this here to be
  // maximally explicit that we based the data structure on
  // Gnosis's implementation of a Multisig
  Create = 2,
}

export type MultisigTransaction = CFCoreTypes.MinimalTransaction & {
  operation: MultisigOperation;
};

export type ProtocolExecutionFlow = {
  [x: number]: (context: Context) => AsyncIterableIterator<any[]>;
};

export type Middleware = {
  (args: any): any;
};

export type Instruction = Function | Opcode;

/// Arguments passed to a protocol execulion flow
export interface Context {
  store: Store;
  log: ILoggerService;
  message: ProtocolMessage;
  network: NetworkContext;
  provider: BaseProvider;
}

export type TakeActionProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  appIdentityHash: string;
  action: SolidityValueType;
};

export {
  AppABIEncodings,
  AppIdentity,
  AppInstanceJson,
  AppInstanceProposal,
  AppInterface,
  CFCoreTypes,
  CoinBalanceRefundState,
  coinBalanceRefundStateEncoding,
  Commitment,
  ConditionalTransactionCommitmentJSON,
  CreateChannelMessage,
  DeployedContractNetworksFileEntry,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  EventEmittedMessage,
  EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT,
  InstallMessage,
  InstallProtocolParams,
  multiAssetMultiPartyCoinTransferEncoding,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  multiAssetMultiPartyCoinTransferInterpreterParamsEncoding,
  NetworkContext,
  NODE_EVENTS,
  NodeEvent,
  NodeMessageWrappedProtocolMessage,
  OutcomeType,
  ProposeInstallProtocolParams,
  ProposeMessage,
  Protocol,
  ProtocolMessage,
  ProtocolParameters,
  ProtocolTypes,
  RejectProposalMessage,
  SetStateCommitmentJSON,
  SetupProtocolParams,
  SignedStateHashUpdate,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  singleAssetTwoPartyCoinTransferInterpreterParamsEncoding,
  SolidityValueType,
  TwoPartyFixedOutcome,
  TwoPartyFixedOutcomeInterpreterParams,
  twoPartyFixedOutcomeInterpreterParamsEncoding,
  UninstallMessage,
  UninstallProtocolParams,
  UpdateProtocolParams,
  UpdateStateMessage,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawProtocolParams,
  WithdrawStartedMessage,
} from "@connext/types";
