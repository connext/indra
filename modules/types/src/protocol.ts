import { AppInstanceJson, AppInterface, AppInstanceProposal, AppABIEncodings } from "./app";
import { BigNumber, BigNumberish, SolidityValueType } from "./basic";
import { OutcomeType } from "./contracts";
import { EventName } from "./events";
import { StateChannelJSON } from "./state";

export enum Protocol {
  Install = "install",
  InstallVirtualApp = "install-virtual-app",
  Setup = "setup",
  Propose = "propose",
  TakeAction = "takeAction",
  Uninstall = "uninstall",
  UninstallVirtualApp = "uninstall-virtual-app",
  Update = "update",
  Withdraw = "withdraw"
}

export type ProtocolMessage = {
  processID: string;
  protocol: Protocol;
  params?: ProtocolParameters;
  toXpub: string;
  seq: number;
  /*
  Additional data which depends on the protocol (or even the specific message
  number in a protocol) lives here. Includes signatures, final outcome of a
  virtual app instance
  */
  customData: { [key: string]: any };
};

export type InstallProtocolParams = {
  initiatorXpub: string;
  initiatorDepositTokenAddress: string;
  responderXpub: string;
  responderDepositTokenAddress: string;
  multisigAddress: string;
  initiatorBalanceDecrement: BigNumber;
  responderBalanceDecrement: BigNumber;
  participants: string[];
  initialState: SolidityValueType;
  appInterface: AppInterface;
  defaultTimeout: number;
  appSeqNo: number;
  // Outcome Type returned by the app instance, as defined by `appInterface`
  outcomeType: OutcomeType;
  // By default, the SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER interpreter params
  // contains a "limit" that is computed as
  // `initiatorBalanceDecrement + responderBalanceDecrement`; setting this
  // flag disables the limit by setting it to MAX_UINT256
  disableLimit: boolean;
};

export type InstallVirtualAppProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  intermediaryXpub: string;
  defaultTimeout: number;
  appInterface: AppInterface;
  initialState: SolidityValueType;
  // initiator and respondor must fund the installed virtual app with the same
  // token type `tokenAddress`, but may use different amounts
  initiatorBalanceDecrement: BigNumber;
  responderBalanceDecrement: BigNumber;
  tokenAddress: string;
  appSeqNo: number;
  // outcomeType returned by the app instance, as defined by the app definition `appInterface`
  outcomeType: OutcomeType;
};

export type ProposeInstallProtocolParams = {
  multisigAddress: string;
  initiatorXpub: string;
  responderXpub: string;
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumber;
  initiatorDepositTokenAddress?: string;
  responderDeposit: BigNumber;
  responderDepositTokenAddress?: string;
  timeout: BigNumber;
  initialState: SolidityValueType;
  outcomeType: OutcomeType;
  meta?: Object;
};

export type SetupProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
};

export type UninstallProtocolParams = {
  appIdentityHash: string;
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  blockNumberToUseIfNecessary?: number;
};

export type UninstallVirtualAppProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  intermediaryXpub: string;
  targetAppIdentityHash: string;
  targetOutcome: string;
};

export type UpdateProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  appIdentityHash: string;
  newState: SolidityValueType;
};

export type WithdrawProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  recipient: string;
  amount: BigNumber;
  tokenAddress: string;
};

export type ProtocolParameters =
  | InstallProtocolParams
  | InstallVirtualAppProtocolParams
  | ProposeInstallProtocolParams
  | SetupProtocolParams
  | UninstallProtocolParams
  | UninstallVirtualAppProtocolParams
  | UpdateProtocolParams
  | WithdrawProtocolParams;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ProtocolTypes {

  // This is used instead of the ethers `Transaction` because that type
  // requires the nonce and chain ID to be specified, when sometimes those
  // arguments are not known at the time of creating a transaction.
  export type MinimalTransaction = {
    to: string;
    value: BigNumberish;
    data: string;
  };

  export interface IPrivateKeyGenerator {
    (s: string): Promise<string>;
  }

  /**
   * Centralized locking service (i.e. redis)
   */
  export interface ILockService {
    acquireLock(
      lockName: string,
      callback: (...args: any[]) => any,
      timeout: number
    ): Promise<any>;
  }

  export enum ErrorType {
    ERROR = "error"
  }

  export enum MethodName {
    ACCEPT_STATE = "acceptState",
    GET_PROPOSED_APP_INSTANCE = "getProposedAppInstance"
  }

  export const RpcMethodNames = {
    chan_create: "chan_create",
    chan_deposit: "chan_deposit",
    chan_deployStateDepositHolder: "chan_deployStateDepositHolder",
    chan_getChannelAddresses: "chan_getChannelAddresses",
    chan_getAppInstance: "chan_getAppInstance",
    chan_getAppInstances: "chan_getAppInstances",
    chan_getStateDepositHolderAddress: "chan_getStateDepositHolderAddress",
    chan_getFreeBalanceState: "chan_getFreeBalanceState",
    chan_getTokenIndexedFreeBalanceStates:
      "chan_getTokenIndexedFreeBalanceStates",
    chan_getProposedAppInstances: "chan_getProposedAppInstances",
    chan_getState: "chan_getState",
    chan_getStateChannel: "chan_getStateChannel",
    chan_install: "chan_install",
    chan_requestDepositRights: "chan_requestDepositRights",
    chan_installVirtual: "chan_installVirtual",
    chan_proposeInstall: "chan_proposeInstall",
    chan_rejectInstall: "chan_rejectInstall",
    chan_updateState: "chan_updateState",
    chan_takeAction: "chan_takeAction",
    chan_uninstall: "chan_uninstall",
    chan_uninstallVirtual: "chan_uninstallVirtual",
    chan_rescindDepositRights: "chan_rescindDepositRights",
    chan_withdraw: "chan_withdraw",
    chan_withdrawCommitment: "chan_withdrawCommitment"
  };
  export type RpcMethodName = keyof typeof RpcMethodNames;

  export type CreateChannelParams = {
    owners: string[];
  };

  export type CreateChannelResult = {
    multisigAddress: string;
    owners: string[];
    counterpartyXpub: string;
  };

  export type CreateChannelTransactionResult = {
    multisigAddress: string;
  };

  export type CreateMultisigParams = {
    owners: string[];
  };

  export type CreateMultisigResult = {
    multisigAddress: string;
  };

  export type DeployStateDepositHolderParams = {
    multisigAddress: string;
    retryCount?: number;
  };

  export type DeployStateDepositHolderResult = {
    transactionHash: string;
  };

  export type DepositParams = {
    multisigAddress: string;
    amount: BigNumber;
    tokenAddress?: string;
  };

  export type DepositResult = {
    multisigBalance: BigNumber;
    tokenAddress: string;
  };

  export type RequestDepositRightsResult = {
    freeBalance: {
      [s: string]: BigNumber;
    };
    recipient: string;
    tokenAddress: string;
  };

  export type GetAppInstanceDetailsParams = {
    appInstanceId: string;
  };

  export type GetAppInstanceDetailsResult = {
    appInstance: AppInstanceJson;
  };

  export type GetStateDepositHolderAddressParams = {
    owners: string[];
  };

  export type GetStateDepositHolderAddressResult = {
    address: string;
  };

  export type GetAppInstancesParams = {
    multisigAddress?: string;
  };

  export type GetAppInstancesResult = {
    appInstances: AppInstanceJson[];
  };

  export type GetChannelAddressesParams = {};

  export type GetChannelAddressesResult = {
    multisigAddresses: string[];
  };

  export type GetFreeBalanceStateParams = {
    multisigAddress: string;
    tokenAddress?: string;
  };

  export type GetFreeBalanceStateResult = {
    [s: string]: BigNumber;
  };

  export type GetTokenIndexedFreeBalanceStatesParams = {
    multisigAddress: string;
  };

  export type GetTokenIndexedFreeBalanceStatesResult = {
    [tokenAddress: string]: {
      [s: string]: BigNumber;
    };
  };

  export type GetProposedAppInstancesParams = {
    multisigAddress?: string;
  };

  export type GetProposedAppInstancesResult = {
    appInstances: AppInstanceProposal[];
  };

  export type GetProposedAppInstanceParams = {
    appInstanceId: string;
  };

  export type GetProposedAppInstanceResult = {
    appInstance: AppInstanceProposal;
  };

  export type GetStateParams = {
    appInstanceId: string;
  };

  export type GetStateResult = {
    state: SolidityValueType;
  };

  export type GetStateChannelParams = {
    multisigAddress: string;
  };

  export type GetStateChannelResult = {
    data: StateChannelJSON;
  };

  export type InstallParams = {
    appInstanceId: string;
  };

  export type RequestDepositRightsParams = {
    multisigAddress: string;
    tokenAddress?: string;
  };

  export type InstallResult = {
    appInstance: AppInstanceJson;
  };

  export type InstallVirtualParams = InstallParams & {
    intermediaryIdentifier: string;
  };

  export type InstallVirtualResult = InstallResult;

  export type ProposeInstallParams = {
    appDefinition: string;
    abiEncodings: AppABIEncodings;
    initiatorDeposit: BigNumber;
    initiatorDepositTokenAddress?: string;
    responderDeposit: BigNumber;
    responderDepositTokenAddress?: string;
    timeout: BigNumber;
    initialState: SolidityValueType;
    proposedToIdentifier: string;
    outcomeType: OutcomeType;
    meta?: Object;
  };

  export type ProposeInstallVirtualParams = ProposeInstallParams & {
    intermediaryIdentifier: string;
  };

  export type ProposeInstallVirtualResult = ProposeInstallResult;

  export type ProposeInstallResult = {
    appInstanceId: string;
  };

  export type RejectInstallParams = {
    appInstanceId: string;
  };

  export type RejectInstallResult = {};

  export type TakeActionParams = {
    appInstanceId: string;
    action: SolidityValueType;
  };

  export type TakeActionResult = {
    newState: SolidityValueType;
  };

  export type UninstallParams = {
    appInstanceId: string;
  };

  export type RescindDepositRightsParams = {
    multisigAddress: string;
    tokenAddress?: string;
  };

  export type UninstallResult = {};

  export type UninstallVirtualParams = UninstallParams & {
    intermediaryIdentifier: string;
  };

  export type UninstallVirtualResult = UninstallResult;

  export type UpdateStateParams = {
    appInstanceId: string;
    newState: SolidityValueType;
  };

  export type UpdateStateResult = {
    newState: SolidityValueType;
  };

  export type WithdrawParams = {
    multisigAddress: string;
    recipient?: string;
    amount: BigNumber;
    tokenAddress?: string;
  };

  export type WithdrawResult = {
    recipient: string;
    txHash: string;
  };

  export type WithdrawCommitmentParams = WithdrawParams;

  export type WithdrawCommitmentResult = {
    transaction: MinimalTransaction;
  };

  export type MethodParams =
    | GetAppInstancesParams
    | GetProposedAppInstancesParams
    | ProposeInstallParams
    | ProposeInstallVirtualParams
    | RejectInstallParams
    | InstallParams
    | InstallVirtualParams
    | GetStateParams
    | GetAppInstanceDetailsParams
    | TakeActionParams
    | UninstallParams
    | CreateChannelParams
    | GetChannelAddressesParams
    | DeployStateDepositHolderParams;
  export type MethodResult =
    | GetAppInstancesResult
    | GetProposedAppInstancesResult
    | ProposeInstallResult
    | ProposeInstallVirtualResult
    | RejectInstallResult
    | InstallResult
    | InstallVirtualResult
    | GetStateResult
    | GetAppInstanceDetailsResult
    | TakeActionResult
    | UninstallResult
    | CreateChannelResult
    | GetChannelAddressesResult
    | DeployStateDepositHolderResult;

  export type CreateMultisigEventData = {
    owners: string[];
    multisigAddress: string;
  };

  export type InstallEventData = {
    appInstanceId: string;
  };

  export type RejectInstallEventData = {
    appInstance: AppInstanceProposal;
  };

  export type UninstallEventData = {
    appInstanceId: string;
  };

  export type UpdateStateEventData = {
    appInstanceId: string;
    newState: SolidityValueType;
    action?: SolidityValueType;
  };

  export type WithdrawEventData = {
    amount: BigNumber;
  };

  export type EventData =
    | InstallEventData
    | RejectInstallEventData
    | UpdateStateEventData
    | UninstallEventData
    | CreateMultisigEventData;

  export type MethodMessage = {
    type: MethodName;
    requestId: string;
  };

  export type MethodRequest = MethodMessage & {
    params: MethodParams;
  };

  export type MethodResponse = MethodMessage & {
    result: MethodResult;
  };

  export type Event = {
    type: EventName;
    data: EventData;
  };

  export type Error = {
    type: ErrorType;
    requestId?: string;
    data: {
      errorName: string;
      message?: string;
      appInstanceId?: string;
      extra?: { [k: string]: string | number | boolean | object };
    };
  };

  export type Message = MethodRequest | MethodResponse | Event | Error;
}

