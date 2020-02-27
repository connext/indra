import { BigNumber } from "../basic";
import {
  TransferParameters,
  TransferResponse,
  ResolveTransferParameters,
  ResolveTransferResponse,
  SIGNATURE_TRANSFER,
} from "./transferInputsDefaults";

// transfer params
export type SignatureTransferParameters<T = string> = TransferParameters<T> & {
  conditionType: typeof SIGNATURE_TRANSFER;
  signer: string;
  recipient: string;
};

export type SignatureTransferParametersBigNumber = SignatureTransferParameters<BigNumber>;

// transfer response
export type SignatureTransferResponse = TransferResponse & {
  signer: string;
};

// resolve params
export type ResolveSignatureTransferParameters<T = string> = ResolveTransferParameters<T> & {
  amount: T;
  assetId: string;
  conditionType: typeof SIGNATURE_TRANSFER;
};

export type ResolveSignatureTransferParametersBigNumber = ResolveSignatureTransferParameters<
  BigNumber
>;

// resolve response
export type ResolveSignatureTransferParametersResponse = ResolveTransferResponse;
