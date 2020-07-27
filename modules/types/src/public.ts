import { providers, BigNumberish } from "ethers";

import { Address, BigNumber, Bytes32, HexString, PublicIdentifier, SignatureString } from "./basic";
import { ConditionalTransferTypes, CreatedConditionalTransferMetaMap } from "./transfers";
import { MethodResults, MethodParams } from "./methods";
import { Attestation, GraphActionType, AppAction, AppState } from "./contracts";
import { enumify } from "./utils";

////////////////////////////////////////
// deposit

type DepositParameters = {
  amount: BigNumberish;
  assetId?: Address; // if not provided, will default to 0x0 (Eth)
};

type DepositResponse = {
  freeBalance: {
    [s: string]: BigNumber;
  };
};

type CheckDepositRightsParameters = {
  assetId?: Address;
};

type CheckDepositRightsResponse = {
  appIdentityHash: Bytes32;
};

type RequestDepositRightsParameters = Omit<MethodParams.RequestDepositRights, "multisigAddress">;
type RequestDepositRightsResponse = MethodResults.RequestDepositRights;

type RescindDepositRightsParameters = Omit<MethodParams.RescindDepositRights, "multisigAddress">;
type RescindDepositRightsResponse = MethodResults.RescindDepositRights;

////////////////////////////////////////
// hashlock

type HashLockTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.HashLockTransfer;
  amount: BigNumberish;
  timelock?: BigNumberish;
  lockHash: Bytes32;
  recipient: PublicIdentifier;
  assetId?: Address;
  meta?: any;
};

type HashLockTransferResponse = {
  appIdentityHash: Bytes32;
};

type ResolveHashLockTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.HashLockTransfer;
  assetId: Address;
  paymentId?: Bytes32;
  preImage: Bytes32;
};

type ResolveHashLockTransferResponse = {
  appIdentityHash: Bytes32;
  sender: PublicIdentifier;
  amount: BigNumber;
  assetId: Address;
  meta?: any;
};

////////////////////////////////////////
// linked transfer

type LinkedTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.LinkedTransfer;
  amount: BigNumberish;
  assetId?: Address;
  paymentId: Bytes32;
  preImage: Bytes32;
  recipient?: PublicIdentifier;
  meta?: any;
};

type LinkedTransferResponse = {
  appIdentityHash: Bytes32;
  paymentId: Bytes32;
  preImage: Bytes32;
};

type ResolveLinkedTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.LinkedTransfer;
  paymentId: Bytes32;
  preImage: Bytes32;
};

type ResolveLinkedTransferResponse = {
  appIdentityHash: Bytes32;
  sender: PublicIdentifier;
  paymentId: Bytes32;
  amount: BigNumber;
  assetId: Address;
  meta?: any;
};

////////////////////////////////////////
// signed transfer

type SignedTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.SignedTransfer;
  amount: BigNumber;
  assetId: Address;
  paymentId: Bytes32;
  signerAddress: Address;
  chainId: number;
  verifyingContract: Address;
  recipient?: PublicIdentifier;
  meta?: any;
};

type SignedTransferResponse = {
  appIdentityHash: Bytes32;
  paymentId: Bytes32;
};

type ResolveSignedTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.SignedTransfer;
  paymentId: Bytes32;
  data: Bytes32;
  signature?: SignatureString;
};

type ResolveSignedTransferResponse = {
  appIdentityHash: Bytes32;
  assetId: Address;
  amount: BigNumber;
  sender: PublicIdentifier;
  meta?: any;
};

////////////////////////////////////////
// graph signed transfer

type GraphSignedTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.GraphTransfer;
  amount: BigNumber;
  assetId: Address;
  paymentId: Bytes32;
  signerAddress: Address;
  chainId: number;
  verifyingContract: Address;
  requestCID: Bytes32;
  subgraphDeploymentID: Bytes32;
  recipient: PublicIdentifier;
  meta?: any;
};

type GraphSignedTransferResponse = {
  appIdentityHash: Bytes32;
  paymentId: Bytes32;
};

type ResolveGraphSignedTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.GraphTransfer;
  paymentId: Bytes32;
  responseCID: Bytes32;
  signature?: SignatureString;
};

type ResolveGraphSignedTransferResponse = {
  appIdentityHash: Bytes32;
  assetId: Address;
  amount: BigNumber;
  sender: PublicIdentifier;
  meta?: any;
};

////////////////////////////////////////
/// graph multi transfer

type GraphMultiTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.GraphMultiTransfer;
  amount: BigNumber;
  assetId: Address;
  paymentId: Bytes32;
  signerAddress: Address;
  chainId: number;
  verifyingContract: Address;
  subgraphDeploymentID: Bytes32;
  recipient: PublicIdentifier;
  meta?: any;
};

type GraphMultiTransferResponse = {
  appIdentityHash: Bytes32;
  paymentId: Bytes32;
};

type ResolveGraphMultiTransferParameters = {
  conditionType: typeof ConditionalTransferTypes.GraphMultiTransfer;
  paymentId: Bytes32;
};

type ResolveGraphMultiTransferResponse = {
  appIdentityHash: Bytes32;
  assetId: Address;
  amount: BigNumber;
  sender: PublicIdentifier;
  meta?: any;
};

type UpdateGraphMultiTransferParameters = {
  paymentId: string;
  conditionType: typeof ConditionalTransferTypes.GraphMultiTransfer;
  actionType: GraphActionType;
  requestCID?: Bytes32;
  price?: BigNumber;
  responseCID?: Bytes32;
  signature?: SignatureString;
}

type UpdateGraphMultiTransferResponse = {
  paymentId: string;
  newState: AppState;
  action: AppAction;
}

////////////////////////////////////////
// conditional transfer

type ConditionalTransferParameters =
  | LinkedTransferParameters
  | HashLockTransferParameters
  | SignedTransferParameters
  | GraphSignedTransferParameters
  | GraphMultiTransferParameters;

type ConditionalTransferResponse = {
  amount: BigNumber;
  appIdentityHash: Bytes32;
  assetId: Address;
  paymentId: Bytes32;
  preImage?: Bytes32;
  sender: Address;
  recipient?: Address;
  meta: any;
  transferMeta: any;
};

////////////////////////////////////////
// update conditional transfer

type UpdateConditionalTransferParameters =
  | UpdateGraphMultiTransferParameters;

type UpdateConditionalTransferResponse =
  | UpdateGraphMultiTransferResponse;

////////////////////////////////////////
// resolve condition

type ResolveConditionParameters =
  | ResolveHashLockTransferParameters
  | ResolveLinkedTransferParameters
  | ResolveSignedTransferParameters
  | ResolveGraphSignedTransferParameters
  | ResolveGraphMultiTransferParameters;

// type ResolveConditionResponse =
//   | ResolveHashLockTransferResponse
//   | ResolveLinkedTransferResponse
//   | ResolveSignedTransferResponse
//   | ResolveGraphSignedTransferResponse;

type ResolveConditionResponse = {
  appIdentityHash: Bytes32;
  assetId: Address;
  amount: BigNumber;
  paymentId: Bytes32;
  sender: PublicIdentifier;
  meta?: any;
};

////////////////////////////////////////
// swap

type SwapParameters = {
  amount: BigNumberish;
  fromAssetId: Address;
  swapRate: string; // DecString?
  toAssetId: Address;
};

type SwapResponse = {
  id: number;
  nodeIdentifier: PublicIdentifier;
  userIdentifier: PublicIdentifier;
  multisigAddress: Address;
  available: boolean;
  activeCollateralizations: { [assetId: string]: boolean };
};

////////////////////////////////////////
// withdraw

type WithdrawParameters = {
  amount: BigNumberish;
  assetId?: Address; // if not provided, will default to 0x0 (Eth)
  recipient?: Address; // if not provided, will default to signer addr
  nonce?: HexString; // generated internally, end user doesn't need to provide it
};

type WithdrawResponse = {
  transaction: providers.TransactionResponse;
};

////////////////////////////////////////
// transfer

type TransferParameters = MethodParams.Deposit & {
  recipient: PublicIdentifier;
  meta?: any;
  paymentId?: Bytes32;
};

type TransferResponse = LinkedTransferResponse;

////////////////////////////////////////
// exports

export namespace PublicParams {
  export type CheckDepositRights = CheckDepositRightsParameters;
  export type ConditionalTransfer = ConditionalTransferParameters;
  export type Deposit = DepositParameters;
  export type HashLockTransfer = HashLockTransferParameters;
  export type LinkedTransfer = LinkedTransferParameters;
  export type RequestDepositRights = RequestDepositRightsParameters;
  export type RescindDepositRights = RescindDepositRightsParameters;
  export type ResolveCondition = ResolveConditionParameters;
  export type ResolveHashLockTransfer = ResolveHashLockTransferParameters;
  export type ResolveLinkedTransfer = ResolveLinkedTransferParameters;
  export type ResolveSignedTransfer = ResolveSignedTransferParameters;
  export type ResolveGraphTransfer = ResolveGraphSignedTransferParameters;
  export type ResolveGraphMultiTransfer = ResolveGraphMultiTransferParameters;
  export type SignedTransfer = SignedTransferParameters;
  export type GraphTransfer = GraphSignedTransferParameters;
  export type GraphMultiTransfer = GraphMultiTransferParameters;
  export type UpdateGraphMultiTransfer = UpdateGraphMultiTransferParameters;
  export type UpdateConditionalTransfer = UpdateConditionalTransferParameters;
  export type Swap = SwapParameters;
  export type Transfer = TransferParameters;
  export type Withdraw = WithdrawParameters;
}

export type PublicParam =
  | CheckDepositRightsParameters
  | ConditionalTransferParameters
  | DepositParameters
  | HashLockTransferParameters
  | LinkedTransferParameters
  | RequestDepositRightsParameters
  | RescindDepositRightsParameters
  | ResolveConditionParameters
  | ResolveHashLockTransferParameters
  | ResolveLinkedTransferParameters
  | ResolveSignedTransferParameters
  | ResolveGraphMultiTransferParameters
  | SignedTransferParameters
  | GraphSignedTransferParameters
  | GraphMultiTransferParameters
  | UpdateGraphMultiTransferParameters
  | UpdateConditionalTransferParameters
  | SwapParameters
  | TransferParameters
  | WithdrawParameters;

export namespace PublicResults {
  export type CheckDepositRights = CheckDepositRightsResponse;
  export type ConditionalTransfer = ConditionalTransferResponse;
  export type Deposit = DepositResponse;
  export type RequestDepositRights = RequestDepositRightsResponse;
  export type RescindDepositRights = RescindDepositRightsResponse;
  export type ResolveCondition = ResolveConditionResponse;
  export type ResolveHashLockTransfer = ResolveHashLockTransferResponse;
  export type ResolveLinkedTransfer = ResolveLinkedTransferResponse;
  export type ResolveSignedTransfer = ResolveSignedTransferResponse;
  export type ResolveGraphTransfer = ResolveGraphSignedTransferResponse;
  export type ResolveGraphMultiTransfer = ResolveGraphMultiTransferResponse;
  export type HashLockTransfer = HashLockTransferResponse;
  export type LinkedTransfer = LinkedTransferResponse;
  export type SignedTransfer = SignedTransferResponse;
  export type GraphTransfer = GraphSignedTransferResponse;
  export type GraphMultiTransfer = GraphMultiTransferResponse;
  export type UpdateGraphMultiTransfer = UpdateGraphMultiTransferResponse;
  export type UpdateConditionalTransfer = UpdateConditionalTransferResponse;
  export type Swap = SwapResponse;
  export type Transfer = TransferResponse;
  export type Withdraw = WithdrawResponse;
}

export type PublicResult =
  | CheckDepositRightsResponse
  | ConditionalTransferResponse
  | DepositResponse
  | HashLockTransferResponse
  | LinkedTransferResponse
  | RequestDepositRightsResponse
  | RescindDepositRightsResponse
  | ResolveConditionResponse
  | ResolveHashLockTransferResponse
  | ResolveLinkedTransferResponse
  | ResolveSignedTransferResponse
  | ResolveGraphSignedTransferResponse
  | ResolveGraphMultiTransferResponse
  | SignedTransferResponse
  | GraphSignedTransferResponse
  | GraphMultiTransferResponse
  | UpdateGraphMultiTransferResponse
  | UpdateConditionalTransferResponse
  | SwapResponse
  | TransferResponse
  | WithdrawResponse;
