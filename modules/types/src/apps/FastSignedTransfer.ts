import { CoinTransfer } from "..";
import { singleAssetTwoPartyCoinTransferEncoding } from "../contracts";
import { BigNumber } from "ethers/utils";

export const FAST_SIGNED_TRANSFER = "FAST_SIGNED_TRANSFER";

export const FastSignedTransferApp = "FastSignedTransferApp";

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
  paymentId: string;
  data: string;
  signature: string;
};

export type ResolveFastSignedTransferResponse<T = string> = {
  appId: string;
  sender: string;
  paymentId: string;
  amount: T;
  assetId: string;
  signer: string;
  meta?: object;
};
export type ResolveFastSignedTransferResponseBigNumber = ResolveFastSignedTransferResponse<
  BigNumber
>;

export enum FastSignedTransferActionType {
  CREATE,
  UNLOCK,
  REJECT,
}

export type FastSignedTransferAppState<T = string> = {
  recipientXpub: string;
  amount: T;
  signer: string;
  paymentId: string;
  coinTransfers: [CoinTransfer<T>, CoinTransfer<T>];
  turnNum: T;
};
export type FastSignedTransferAppStateBigNumber = FastSignedTransferAppState<BigNumber>;

export type FastSignedTransferAppAction<T = string> = {
  recipientXpub: string;
  amount: T;
  signer: string;
  paymentId: string;
  data: string;
  signature: string;
  actionType: FastSignedTransferActionType;
};
export type FastSignedTransferAppActionBigNumber = FastSignedTransferAppAction<BigNumber>;

export const FastSignedTransferAppStateEncoding = `
  tuple(
    string recipientXpub,
    uint256 amount,
    address signer,
    bytes32 paymentId,
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    uint256 turnNum
  )
`;

export const FastSignedTransferAppActionEncoding = `
  tuple(
    string recipientXpub,
    uint256 amount,
    address signer,
    bytes32 paymentId,
    bytes32 data,
    bytes signature,
    uint256 actionType
  )
`;
