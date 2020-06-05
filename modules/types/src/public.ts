import { providers, BigNumberish } from "ethers";

import { Address, BigNumber, Bytes32, HexString, PublicIdentifier, SignatureString } from "./basic";
import { ConditionalTransferTypes, CreatedConditionalTransferMetaMap } from "./transfers";
import { MethodResults, MethodParams } from "./methods";
import { Attestation } from "./contracts";

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
  requestCID: Bytes32;
  subgraphDeploymentID: Bytes32;
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
  responseCID: Bytes32;
  signature: SignatureString;
};

type ResolveSignedTransferResponse = {
  appIdentityHash: Bytes32;
  assetId: Address;
  amount: BigNumber;
  sender: PublicIdentifier;
  meta?: any;
};

////////////////////////////////////////
// conditional transfer

type ConditionalTransferParameters =
  | LinkedTransferParameters
  | HashLockTransferParameters
  | SignedTransferParameters;

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
// resolve condition

type ResolveConditionParameters =
  | ResolveHashLockTransferParameters
  | ResolveLinkedTransferParameters
  | ResolveSignedTransferParameters;

// type ResolveConditionResponse =
//   | ResolveHashLockTransferResponse
//   | ResolveLinkedTransferResponse
//   | ResolveSignedTransferResponse;

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
  export type SignedTransfer = SignedTransferParameters;
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
  | SignedTransferParameters
  | SwapParameters
  | TransferParameters
  | WithdrawParameters;

export namespace PublicResults {
  export type CheckDepositRights = CheckDepositRightsResponse;
  export type ConditionalTransfer = ConditionalTransferResponse;
  export type Deposit = DepositResponse;
  export type HashLockTransfer = HashLockTransferResponse;
  export type LinkedTransfer = LinkedTransferResponse;
  export type RequestDepositRights = RequestDepositRightsResponse;
  export type RescindDepositRights = RescindDepositRightsResponse;
  export type ResolveCondition = ResolveConditionResponse;
  export type ResolveHashLockTransfer = ResolveHashLockTransferResponse;
  export type ResolveLinkedTransfer = ResolveLinkedTransferResponse;
  export type ResolveSignedTransfer = ResolveSignedTransferResponse;
  export type SignedTransfer = SignedTransferResponse;
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
  | SignedTransferResponse
  | SwapResponse
  | TransferResponse
  | WithdrawResponse;
