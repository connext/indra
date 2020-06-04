import { Address, Bytes32 } from "../../basic";
import { tidy } from "../../utils";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";

export const SimpleSignedTransferAppName = "SimpleSignedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/SimpleSignedTransferApp.sol

export interface Receipt {
  requestCID: string;
  responseCID: string;
  subgraphDeploymentID: string;
}

export interface Attestation extends Receipt {
  signature: string;
}

// ABI Encoding TS Typess
export type SimpleSignedTransferAppState = {
  coinTransfers: CoinTransfer[];
  signerAddress: Address;
  chainId: number;
  verifyingContract: Address;
  paymentId: Bytes32;
  finalized: boolean;
};

// ABI Encodings
export const SimpleSignedTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  address signerAddress,
  uint256 chainId,
  address verifyingContract,
  bytes32 paymentId,
  bool finalized
)`);

export type SimpleSignedTransferAppAction = Attestation;

export const SimpleSignedTransferAppActionEncoding = tidy(`tuple(
  bytes32 requestCID,
  bytes32 responseCID,
  bytes32 subgraphDeploymentID,
  bytes signature
)`);
