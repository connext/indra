import { Address, BigNumber, SolidityValueType, Xpub } from "./basic";
import { AppState } from "./contracts";

import { AppABIEncodings, AppInstanceJson, AppInstanceProposal } from "./app";
import { OutcomeType } from "./contracts";
import { StateChannelJSON } from "./state";
import { MinimalTransaction } from "./commitments";

////////////////////////////////////////

type CreateChannelParams = {
  owners: Xpub[];
};

type CreateChannelResult = {
  multisigAddress: Address;
  owners?: Xpub[];
  counterpartyXpub?: Xpub;
};

////////////////////////////////////////

type DepositParams = {
  multisigAddress: string;
  amount: BigNumber;
  tokenAddress?: string;
};

type DepositResult = {
  multisigBalance: BigNumber;
  tokenAddress: string;
  transactionHash: string;
};

////////////////////////////////////////

type DeployStateDepositHolderParams = {
  multisigAddress: string;
  retryCount?: number;
};

type DeployStateDepositHolderResult = {
  transactionHash: string;
};

////////////////////////////////////////

type GetChannelAddressesParams = {};

type GetChannelAddressesResult = {
  multisigAddresses: string[];
};

////////////////////////////////////////

type GetAppInstanceDetailsParams = {
  appInstanceId: string;
};

type GetAppInstanceDetailsResult = {
  appInstance: AppInstanceJson;
};

////////////////////////////////////////

type GetAppInstancesParams = {
  multisigAddress: string;
};

type GetAppInstancesResult = {
  appInstances: AppInstanceJson[];
};

////////////////////////////////////////

type GetStateDepositHolderAddressParams = {
  owners: string[];
};

type GetStateDepositHolderAddressResult = {
  address: string;
};

////////////////////////////////////////

type GetFreeBalanceStateParams = {
  multisigAddress: string;
  tokenAddress?: string;
};

type GetFreeBalanceStateResult = {
  [s: string]: BigNumber;
};

////////////////////////////////////////

type GetTokenIndexedFreeBalanceStatesParams = {
  multisigAddress: string;
};

type GetTokenIndexedFreeBalanceStatesResult = {
  [tokenAddress: string]: {
    [s: string]: BigNumber;
  };
};

////////////////////////////////////////

type GetProposedAppInstanceParams = {
  appInstanceId: string;
};

type GetProposedAppInstanceResult = {
  appInstance: AppInstanceProposal;
};

////////////////////////////////////////

type GetProposedAppInstancesParams = {
  multisigAddress: string;
};

type GetProposedAppInstancesResult = {
  appInstances: AppInstanceProposal[];
};

////////////////////////////////////////

type GetStateParams = {
  appInstanceId: string;
};

type GetStateResult = {
  state: SolidityValueType;
};

////////////////////////////////////////

type GetStateChannelParams = {
  multisigAddress: string;
};

type GetStateChannelResult = {
  data: StateChannelJSON;
};

////////////////////////////////////////

type InstallParams = {
  appInstanceId: string;
};

type InstallResult = {
  appInstance: AppInstanceJson;
};

////////////////////////////////////////

type RequestDepositRightsParams = {
  multisigAddress: string;
  tokenAddress?: string;
};

type RequestDepositRightsResult = {
  freeBalance: {
    [s: string]: BigNumber;
  };
  recipient: string;
  tokenAddress: string;
};

////////////////////////////////////////

type ProposeInstallParams = {
  appDefinition: Address;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumber;
  initiatorDepositTokenAddress: Address;
  responderDeposit: BigNumber;
  responderDepositTokenAddress: Address;
  timeout: BigNumber;
  initialState: AppState;
  proposedToIdentifier: string;
  outcomeType: OutcomeType;
  meta?: Object;
};

type ProposeInstallResult = {
  appInstanceId: string;
};

////////////////////////////////////////

type RejectInstallParams = {
  appInstanceId: string;
};

type RejectInstallResult = {};

////////////////////////////////////////

type UpdateStateParams = {
  appInstanceId: string;
  newState: SolidityValueType;
};

type UpdateStateResult = {
  newState: SolidityValueType;
};

////////////////////////////////////////

type TakeActionParams = {
  appInstanceId: string;
  action: SolidityValueType;
};

type TakeActionResult = {
  newState: SolidityValueType;
};

////////////////////////////////////////

type UninstallParams = {
  appInstanceId: string;
};

type UninstallResult = {};

////////////////////////////////////////

type RescindDepositRightsParams = {
  multisigAddress: string;
  tokenAddress?: string;
};

type RescindDepositRightsResult = {
  multisigBalance: BigNumber;
  tokenAddress: string;
};

////////////////////////////////////////

type WithdrawParams = {
  multisigAddress: string;
  recipient?: string;
  amount: BigNumber;
  tokenAddress?: string;
};

type WithdrawResult = {
  recipient: string;
  txHash: string;
};

////////////////////////////////////////

type WithdrawCommitmentParams = WithdrawParams;

type WithdrawCommitmentResult = {
  transaction: MinimalTransaction;
};

////////////////////////////////////////
// exports

export enum MethodNames {
  chan_create = "chan_create",
  chan_deployStateDepositHolder = "chan_deployStateDepositHolder",
  chan_deposit = "chan_deposit",
  chan_getAppInstance = "chan_getAppInstance",
  chan_getAppInstances = "chan_getAppInstances",
  chan_getChannelAddresses = "chan_getChannelAddresses",
  chan_getFreeBalanceState = "chan_getFreeBalanceState",
  chan_getProposedAppInstance = "chan_getProposedAppInstance",
  chan_getProposedAppInstances = "chan_getProposedAppInstances",
  chan_getState = "chan_getState",
  chan_getStateChannel = "chan_getStateChannel",
  chan_getStateDepositHolderAddress = "chan_getStateDepositHolderAddress",
  chan_getTokenIndexedFreeBalanceStates = "chan_getTokenIndexedFreeBalanceStates",
  chan_install = "chan_install",
  chan_proposeInstall = "chan_proposeInstall",
  chan_rejectInstall = "chan_rejectInstall",
  chan_requestDepositRights = "chan_requestDepositRights",
  chan_rescindDepositRights = "chan_rescindDepositRights",
  chan_takeAction = "chan_takeAction",
  chan_uninstall = "chan_uninstall",
  chan_updateState = "chan_updateState",
  chan_withdraw = "chan_withdraw",
  chan_withdrawCommitment = "chan_withdrawCommitment",
};
export type MethodName = keyof typeof MethodNames;

export namespace MethodParams {
  export type CreateChannel = CreateChannelParams;
  export type DeployStateDepositHolder = DeployStateDepositHolderParams;
  export type Deposit = DepositParams;
  export type GetAppInstanceDetails = GetAppInstanceDetailsParams;
  export type GetAppInstances = GetAppInstancesParams
  export type GetChannelAddresses = GetChannelAddressesParams;
  export type GetFreeBalanceState = GetFreeBalanceStateParams;
  export type GetProposedAppInstance = GetProposedAppInstanceParams;
  export type GetProposedAppInstances = GetProposedAppInstancesParams;
  export type GetState = GetStateParams;
  export type GetStateChannel = GetStateChannelParams;
  export type GetStateDepositHolderAddress = GetStateDepositHolderAddressParams;
  export type GetTokenIndexedFreeBalanceStates = GetTokenIndexedFreeBalanceStatesParams;
  export type Install = InstallParams;
  export type ProposeInstall = ProposeInstallParams;
  export type RejectInstall = RejectInstallParams;
  export type RequestDepositRights = RequestDepositRightsParams;
  export type RescindDepositRights = RescindDepositRightsParams;
  export type TakeAction = TakeActionParams;
  export type Uninstall = UninstallParams;
  export type UpdateState = UpdateStateParams;
  export type Withdraw = WithdrawParams;
  export type WithdrawCommitment = WithdrawCommitmentParams;
}

export type MethodParam =
  | CreateChannelParams
  | DeployStateDepositHolderParams
  | DepositParams
  | GetAppInstanceDetailsParams
  | GetAppInstancesParams
  | GetChannelAddressesParams
  | GetFreeBalanceStateParams
  | GetProposedAppInstanceParams
  | GetProposedAppInstancesParams
  | GetStateParams
  | GetStateChannelParams
  | GetStateDepositHolderAddressParams
  | GetTokenIndexedFreeBalanceStatesParams
  | InstallParams
  | ProposeInstallParams
  | RejectInstallParams
  | RequestDepositRightsParams
  | RescindDepositRightsParams
  | TakeActionParams
  | UninstallParams
  | UpdateStateParams
  | WithdrawParams
  | WithdrawCommitmentParams;

export namespace MethodResults {
  export type CreateChannel = CreateChannelResult;
  export type DeployStateDepositHolder = DeployStateDepositHolderResult;
  export type Deposit = DepositResult;
  export type GetAppInstanceDetails = GetAppInstanceDetailsResult;
  export type GetAppInstances = GetAppInstancesResult
  export type GetChannelAddresses = GetChannelAddressesResult;
  export type GetFreeBalanceState = GetFreeBalanceStateResult;
  export type GetProposedAppInstance = GetProposedAppInstanceResult;
  export type GetProposedAppInstances = GetProposedAppInstancesResult;
  export type GetState = GetStateResult;
  export type GetStateChannel = GetStateChannelResult;
  export type GetStateDepositHolderAddress = GetStateDepositHolderAddressResult;
  export type GetTokenIndexedFreeBalanceStates = GetTokenIndexedFreeBalanceStatesResult;
  export type Install = InstallResult;
  export type ProposeInstall = ProposeInstallResult;
  export type RejectInstall = RejectInstallResult;
  export type RequestDepositRights = RequestDepositRightsResult;
  export type RescindDepositRights = RescindDepositRightsResult;
  export type TakeAction = TakeActionResult;
  export type Uninstall = UninstallResult;
  export type UpdateState = UpdateStateResult;
  export type Withdraw = WithdrawResult;
  export type WithdrawCommitment = WithdrawCommitmentResult;
}

export type MethodResult =
  | CreateChannelResult
  | DeployStateDepositHolderResult
  | DepositResult
  | GetAppInstanceDetailsResult
  | GetAppInstancesResult
  | GetChannelAddressesResult
  | GetFreeBalanceStateResult
  | GetProposedAppInstanceResult
  | GetProposedAppInstancesResult
  | GetStateResult
  | GetStateChannelResult
  | GetStateDepositHolderAddressResult
  | GetTokenIndexedFreeBalanceStatesResult
  | InstallResult
  | ProposeInstallResult
  | RejectInstallResult
  | RequestDepositRightsResult
  | RescindDepositRightsResult
  | TakeActionResult
  | UninstallResult
  | UpdateStateResult
  | WithdrawResult
  | WithdrawCommitmentResult;
