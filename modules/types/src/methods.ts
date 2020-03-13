import { Address, BigNumber, SolidityValueType, Xpub } from "./basic";

import { AppABIEncodings, AppInstanceJson, AppInstanceProposal } from "./app";
import { OutcomeType } from "./contracts";
import { StateChannelJSON } from "./state";
import { MinimalTransaction } from "./commitments";

////////////////////////////////////////
export const chan_create = "chan_create";

export type CreateMultisigParams = {
  owners: string[];
};

export type CreateChannelParams = {
  owners: string[];
};

export type CreateMultisigResult = {
  multisigAddress: Address;
};

export type CreateChannelResult = {
  multisigAddress: string;
  owners: string[];
  counterpartyXpub: Xpub;
};

export type CreateChannelTransactionResult = {
  multisigAddress: string;
};

////////////////////////////////////////
export const chan_deposit = "chan_deposit";

export type DepositParams = {
  multisigAddress: string;
  amount: BigNumber;
  tokenAddress?: string;
};

export type DepositResult = {
  multisigBalance: BigNumber;
  tokenAddress: string;
  transactionHash: string;
};

////////////////////////////////////////
export const chan_deployStateDepositHolder = "chan_deployStateDepositHolder";

export type DeployStateDepositHolderParams = {
  multisigAddress: string;
  retryCount?: number;
};

export type DeployStateDepositHolderResult = {
  transactionHash: string;
};

////////////////////////////////////////
export const chan_getChannelAddresses = "chan_getChannelAddresses";

export type GetChannelAddressesParams = {};

export type GetChannelAddressesResult = {
  multisigAddresses: string[];
};

////////////////////////////////////////
export const chan_getAppInstance = "chan_getAppInstance";

export type GetAppInstanceDetailsParams = {
  appInstanceId: string;
};

export type GetAppInstanceDetailsResult = {
  appInstance: AppInstanceJson;
};

////////////////////////////////////////
export const chan_getAppInstances = "chan_getAppInstances";

export type GetAppInstancesParams = {
  multisigAddress: string;
};

export type GetAppInstancesResult = {
  appInstances: AppInstanceJson[];
};

////////////////////////////////////////
export const chan_getStateDepositHolderAddress = "chan_getStateDepositHolderAddress";

export type GetStateDepositHolderAddressParams = {
  owners: string[];
};

export type GetStateDepositHolderAddressResult = {
  address: string;
};

////////////////////////////////////////
export const chan_getFreeBalanceState = "chan_getFreeBalanceState";

export type GetFreeBalanceStateParams = {
  multisigAddress: string;
  tokenAddress?: string;
};

export type GetFreeBalanceStateResult = {
  [s: string]: BigNumber;
};

////////////////////////////////////////
export const chan_getTokenIndexedFreeBalanceStates = "chan_getTokenIndexedFreeBalanceStates";

export type GetTokenIndexedFreeBalanceStatesParams = {
  multisigAddress: string;
};

export type GetTokenIndexedFreeBalanceStatesResult = {
  [tokenAddress: string]: {
    [s: string]: BigNumber;
  };
};

////////////////////////////////////////
export const chan_getProposedAppInstance = "chan_getProposedAppInstance";

export type GetProposedAppInstanceParams = {
  appInstanceId: string;
};

export type GetProposedAppInstanceResult = {
  appInstance: AppInstanceProposal;
};

////////////////////////////////////////
export const chan_getProposedAppInstances = "chan_getProposedAppInstances";

export type GetProposedAppInstancesParams = {
  multisigAddress: string;
};

export type GetProposedAppInstancesResult = {
  appInstances: AppInstanceProposal[];
};

////////////////////////////////////////
export const chan_getState = "chan_getState";

export type GetStateParams = {
  appInstanceId: string;
};

export type GetStateResult = {
  state: SolidityValueType;
};

////////////////////////////////////////
export const chan_getStateChannel = "chan_getStateChannel";

export type GetStateChannelParams = {
  multisigAddress: string;
};

export type GetStateChannelResult = {
  data: StateChannelJSON;
};

////////////////////////////////////////
export const chan_install = "chan_install";

export type InstallParams = {
  appInstanceId: string;
};

export type InstallResult = {
  appInstance: AppInstanceJson;
};

////////////////////////////////////////
export const chan_requestDepositRights = "chan_requestDepositRights";

export type RequestDepositRightsParams = {
  multisigAddress: string;
  tokenAddress?: string;
};

export type RequestDepositRightsResult = {
  freeBalance: {
    [s: string]: BigNumber;
  };
  recipient: string;
  tokenAddress: string;
};

////////////////////////////////////////
export const chan_proposeInstall = "chan_proposeInstall";

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

export type ProposeInstallResult = {
  appInstanceId: string;
};

////////////////////////////////////////
export const chan_rejectInstall = "chan_rejectInstall";

export type RejectInstallParams = {
  appInstanceId: string;
};

export type RejectInstallResult = {};

////////////////////////////////////////
export const chan_updateState = "chan_updateState";

export type UpdateStateParams = {
  appInstanceId: string;
  newState: SolidityValueType;
};

export type UpdateStateResult = {
  newState: SolidityValueType;
};

////////////////////////////////////////
export const chan_takeAction = "chan_takeAction";

export type TakeActionParams = {
  appInstanceId: string;
  action: SolidityValueType;
};

export type TakeActionResult = {
  newState: SolidityValueType;
};

////////////////////////////////////////
export const chan_uninstall = "chan_uninstall";

export type UninstallParams = {
  appInstanceId: string;
};

export type UninstallResult = {};

////////////////////////////////////////
export const chan_rescindDepositRights = "chan_rescindDepositRights";

export type RescindDepositRightsParams = {
  multisigAddress: string;
  tokenAddress?: string;
};

export type RescindDepositRightsResult = {
  multisigBalance: BigNumber;
  tokenAddress: string;
};

////////////////////////////////////////
export const chan_withdraw = "chan_withdraw";

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

////////////////////////////////////////
export const chan_withdrawCommitment = "chan_withdrawCommitment";

export type WithdrawCommitmentParams = WithdrawParams;

export type WithdrawCommitmentResult = {
  transaction: MinimalTransaction;
};

////////////////////////////////////////
export const MethodNames = {
  [chan_create]: chan_create,
  [chan_deployStateDepositHolder]: chan_deployStateDepositHolder,
  [chan_deposit]: chan_deposit,
  [chan_getAppInstance]: chan_getAppInstance,
  [chan_getAppInstances]: chan_getAppInstances,
  [chan_getChannelAddresses]: chan_getChannelAddresses,
  [chan_getFreeBalanceState]: chan_getFreeBalanceState,
  [chan_getProposedAppInstance]: chan_getProposedAppInstance,
  [chan_getProposedAppInstances]: chan_getProposedAppInstances,
  [chan_getState]: chan_getState,
  [chan_getStateChannel]: chan_getStateChannel,
  [chan_getStateDepositHolderAddress]: chan_getStateDepositHolderAddress,
  [chan_getTokenIndexedFreeBalanceStates]: chan_getTokenIndexedFreeBalanceStates,
  [chan_install]: chan_install,
  [chan_proposeInstall]: chan_proposeInstall,
  [chan_rejectInstall]: chan_rejectInstall,
  [chan_requestDepositRights]: chan_requestDepositRights,
  [chan_rescindDepositRights]: chan_rescindDepositRights,
  [chan_takeAction]: chan_takeAction,
  [chan_uninstall]: chan_uninstall,
  [chan_updateState]: chan_updateState,
  [chan_withdraw]: chan_withdraw,
  [chan_withdrawCommitment]: chan_withdrawCommitment,
};
export type MethodName = keyof typeof MethodNames;

export type MethodParams =
  | GetAppInstancesParams
  | GetProposedAppInstancesParams
  | ProposeInstallParams
  | RejectInstallParams
  | InstallParams
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
  | RejectInstallResult
  | InstallResult
  | GetStateResult
  | GetAppInstanceDetailsResult
  | TakeActionResult
  | UninstallResult
  | CreateChannelResult
  | GetChannelAddressesResult
  | DeployStateDepositHolderResult;

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
