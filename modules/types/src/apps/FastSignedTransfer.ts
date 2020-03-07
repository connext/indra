import { CoinTransfer } from "..";
import { singleAssetTwoPartyCoinTransferEncoding } from "../contracts";
import { BigNumber } from "ethers/utils";

export const FAST_SIGNED_TRANSFER = "FAST_SIGNED_TRANSFER";

export type FastSignedTransferParameters<T = string> = {
  conditionType: typeof FAST_SIGNED_TRANSFER;
  recipient: string;
  amount: T;
  assetId?: string;
  paymentId: string;
  maxAllocation?: T;
  signer: string;
  meta?: object;
};

export type FastSignedTransferResponse = {
  transferAppInstanceId: string;
};

export type ResolveFastSignedTransferParameters = {
  conditionType: typeof FAST_SIGNED_TRANSFER;
  data: string;
  signature: string;
};

export enum FastSignedTransferActionType {
  CREATE,
  UNLOCK,
  REJECT,
}

export type FastSignedTransfer<T = string> = {
  receipientXpub: string;
  amount: T;
  signer: string;
  paymentId: string;
  data: string;
  signature: string;
};

export type FastSignedTransferAppState<T = string> = {
  lockedPayments: FastSignedTransfer<T>[];
  coinTransfers: [CoinTransfer<T>, CoinTransfer<T>];
  finalized: boolean;
  turnNum: T;
};
export type FastSignedTransferAppStateBigNumber = FastSignedTransferAppState<BigNumber>;

export type FastSignedTransferAppAction<T = string> = {
  newLockedPayments: FastSignedTransfer<T>[];
  actionType: FastSignedTransferActionType;
};
export type FastSignedTransferAppActionBigNumber = FastSignedTransferAppAction<BigNumber>;

export const FastSignerTransferAppPaymentsEncoding = `
  tuple(
    string receipientXpub,
    uint256 amount,
    address signer,
    bytes32 paymentId,
    bytes32 data,
    bytes signature
  )[]
`;

export const FastSignerTransferAppStateEncoding = `
  tuple(
    ${FastSignerTransferAppPaymentsEncoding} lockedPayments,
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    uint256 turnNum
  )
`;

export const FastSignerTransferAppActionEncoding = `
  tuple(
    ${FastSignerTransferAppPaymentsEncoding} newLockedPayments,
    uint256 actionType
  )
`;
