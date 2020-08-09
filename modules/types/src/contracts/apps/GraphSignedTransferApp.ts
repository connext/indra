import { Address, Bytes32, SignatureString } from "../../basic";
import { tidy } from "../../utils";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";

export const GraphSignedTransferAppName = "GraphSignedTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/GraphSignedTransferApp.sol



// ABI Encoding TS Typess
export type GraphSignedTransferAppState = {
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
export const GraphSignedTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  address signerAddress,
  uint256 chainId,
  address verifyingContract,
  bytes32 requestCID,
  bytes32 subgraphDeploymentID,
  bytes32 paymentId,
  bool finalized
)`);

export type GraphSignedTransferAppAction = {
  responseCID: Bytes32;
  signature: SignatureString;
};

export const GraphSignedTransferAppActionEncoding = tidy(`tuple(
  bytes32 responseCID,
  bytes signature
)`);
