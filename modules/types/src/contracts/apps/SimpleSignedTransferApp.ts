import { Address, Bytes32, SignatureString } from "../../basic";
import { tidy } from "../../utils";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";

export const SimpleSignedTransferAppName = "SimpleSignedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/SimpleSignedTransferApp.sol

export interface Receipt {
  requestCID: Bytes32;
  responseCID: Bytes32;
  subgraphDeploymentID: Bytes32;
}

export interface Attestation extends Receipt {
  signature: SignatureString;
}

// ABI Encoding TS Typess
export type SimpleSignedTransferAppState = {
  coinTransfers: CoinTransfer[];
  signerAddress: Address;
  chainId: number;
  verifyingContract: Address;
  requestCID: Bytes32;
  subgraphDeploymentID: Bytes32;
  paymentId: Bytes32;
  finalized: boolean;
};

// ABI Encodings
export const SimpleSignedTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  address signerAddress,
  uint256 chainId,
  address verifyingContract,
  bytes32 requestCID,
  bytes32 subgraphDeploymentID,
  bytes32 paymentId,
  bool finalized
)`);

export type SimpleSignedTransferAppAction = {
  responseCID: Bytes32;
  signature: SignatureString;
};

export const SimpleSignedTransferAppActionEncoding = tidy(`tuple(
  bytes32 responseCID,
  bytes signature
)`);
