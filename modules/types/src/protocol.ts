import { AppInterface, AppABIEncodings } from "./app";
import { Address, BigNumber, Bytes32, SolidityValueType, Xpub } from "./basic";
import { OutcomeType } from "./contracts";
import { enumify } from "./utils";

type InstallProtocolParams = {
  initiatorXpub: Xpub;
  initiatorDepositTokenAddress: Address;
  responderXpub: Xpub;
  responderDepositTokenAddress: Address;
  multisigAddress: Address;
  initiatorBalanceDecrement: BigNumber;
  responderBalanceDecrement: BigNumber;
  initialState: SolidityValueType;
  appInterface: AppInterface;
  meta?: Object;
  defaultTimeout: number;
  appSeqNo: number;
  // Outcome Type returned by the app instance, as defined by `appInterface`
  outcomeType: OutcomeType;
  // By default, the SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER interpreter params
  // contains a "limit" that is computed as
  // `initiatorBalanceDecrement + responderBalanceDecrement`; setting this
  // flag disables the limit by setting it to MAX_UINT256
  disableLimit: boolean;
  // these are set during the proposal for the app instance
  // set state commitment generation
  appInitiatorAddress: string;
  appResponderAddress: string;
};

type ProposeProtocolParams = {
  multisigAddress: Address;
  initiatorXpub: Xpub;
  responderXpub: Xpub;
  appDefinition: Address;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumber;
  initiatorDepositTokenAddress: Address;
  responderDeposit: BigNumber;
  responderDepositTokenAddress: Address;
  timeout: BigNumber;
  initialState: SolidityValueType;
  outcomeType: OutcomeType;
  meta?: Object;
};

type SetupProtocolParams = {
  initiatorXpub: Xpub;
  responderXpub: Xpub;
  multisigAddress: Address;
};

type TakeActionProtocolParams = {
  initiatorXpub: Xpub;
  responderXpub: Xpub;
  multisigAddress: Address;
  appIdentityHash: Address;
  action: SolidityValueType;
};

type UninstallProtocolParams = {
  appIdentityHash: Bytes32;
  initiatorXpub: Xpub;
  responderXpub: Xpub;
  multisigAddress: Address;
  blockNumberToUseIfNecessary?: number;
};

type UpdateProtocolParams = {
  initiatorXpub: Xpub;
  responderXpub: Xpub;
  multisigAddress: Address;
  appIdentityHash: Address;
  newState: SolidityValueType;
};

////////////////////////////////////////
// exports

export enum Opcode {
  // Middleware hook to send a ProtocolMessage to a peer.
  IO_SEND,
  // Middleware hook to both send and wait for a response from a ProtocolMessage
  IO_SEND_AND_WAIT,
  // Requests a signature on the hash of previously generated EthereumCommitments.
  OP_SIGN,
  // Middleware hook to write the app instances to store.
  PERSIST_APP_INSTANCE,
  // Called at the end of execution before the return value to store a commitment
  PERSIST_COMMITMENT,
  // Middleware hook to write the state channel to store. Used to lock channel between protocols.
  PERSIST_STATE_CHANNEL,
  // Middleware hook to validate state transitions in protocol. Called before
  // `computeStateTransition` and registered using `injectMiddleware`
  OP_VALIDATE,
}

export const ProtocolNames = enumify({
  install: "install",
  propose: "propose",
  setup: "setup",
  takeAction: "takeAction",
  uninstall: "uninstall",
  update: "update",
});
export type ProtocolNames = (typeof ProtocolNames)[keyof typeof ProtocolNames];
export type ProtocolName = keyof typeof ProtocolNames;

export namespace ProtocolParams {
  export type Install = InstallProtocolParams;
  export type Propose = ProposeProtocolParams;
  export type Setup = SetupProtocolParams;
  export type TakeAction = TakeActionProtocolParams;
  export type Uninstall = UninstallProtocolParams;
  export type Update = UpdateProtocolParams;
}

export type ProtocolParam =
  | InstallProtocolParams
  | ProposeProtocolParams
  | SetupProtocolParams
  | TakeActionProtocolParams
  | UninstallProtocolParams
  | UpdateProtocolParams;
