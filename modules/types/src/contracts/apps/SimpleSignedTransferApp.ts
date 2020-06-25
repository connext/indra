import { Address, Bytes32, SignatureString } from "../../basic";
import { tidy } from "../../utils";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";

export const SimpleSignedTransferAppName = "SimpleSignedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/SimpleSignedTransferApp.sol

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
  salt: string;
}

// ABI Encoding TS Typess
export type SimpleSignedTransferAppState = {
  coinTransfers: CoinTransfer[];
  signerAddress: Address;
  domainSeparator: Bytes32;
  paymentId: Bytes32;
  finalized: boolean;
};

// ABI Encodings
export const SimpleSignedTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  address signerAddress,
  bytes32 domainSeparator,
  bytes32 paymentId,
  bool finalized
)`);

export type SimpleSignedTransferAppAction = {
  data: Bytes32;
  signature: SignatureString;
};

export const SimpleSignedTransferAppActionEncoding = tidy(`tuple(
  bytes32 data,
  bytes signature
)`);
