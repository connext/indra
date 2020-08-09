import { Address, Bytes32, SignatureString } from "../../basic";
import { tidy } from "../../utils";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";
import { BigNumber } from "ethers";

export const GraphBatchedTransferAppName = "GraphBatchedTransferApp";

export const GRAPH_BATCHED_SWAP_CONVERSION = BigNumber.from(10).pow(18);

////////////////////////////////////////
// keep synced w contracts/app/GraphBatchedTransferApp.sol

export interface GraphReceipt {
  requestCID: Bytes32;
  responseCID: Bytes32;
  subgraphDeploymentID: Bytes32;
}

export interface GraphAttestation extends GraphReceipt {
  signature: SignatureString;
}

// ABI Encoding TS Typess
export type GraphBatchedTransferAppState = {
  coinTransfers: CoinTransfer[];
  attestationSigner: Address;
  consumerSigner: Address;
  chainId: number;
  verifyingContract: Address;
  subgraphDeploymentID: Bytes32;
  swapRate: BigNumber;
  paymentId: Bytes32;
  finalized: boolean;
};

// ABI Encodings
export const GraphBatchedTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  address attestationSigner,
  address consumerSigner,
  uint256 chainId,
  address verifyingContract,
  bytes32 subgraphDeploymentID,
  uint256 swapRate,
  bytes32 paymentId,
  bool finalized
)`);

export type GraphBatchedTransferAppAction = {
  totalPaid: BigNumber;
  requestCID: Bytes32;
  responseCID: Bytes32;
  consumerSignature: SignatureString;
  attestationSignature: SignatureString;
};

export const GraphBatchedTransferAppActionEncoding = tidy(`tuple(
    uint256 totalPaid,
    bytes32 requestCID,
    bytes32 responseCID,
    bytes consumerSignature,
    bytes attestationSignature
)`);
