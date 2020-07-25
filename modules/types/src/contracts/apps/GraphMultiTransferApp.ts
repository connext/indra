import { Address, Bytes32, SignatureString } from "../../basic";
import { tidy, enumify } from "../../utils";

import { CoinTransfer } from "../funding";
import { singleAssetTwoPartyCoinTransferEncoding } from "../misc";
import { BigNumber, Bytes } from "ethers";

export const GraphMultiTransferAppName = "GraphMultiTransferApp";

////////////////////////////////////////
// keep synced w contracts/app/GraphMultiTransferApp.sol

// export interface GraphReceipt {
//   requestCID: Bytes32;
//   responseCID: Bytes32;
//   subgraphDeploymentID: Bytes32;
// }

// export interface GraphAttestation extends GraphReceipt {
//   signature: SignatureString;
// }

export type GraphLockedPayment = {
    requestCID: Bytes32;
    price: BigNumber;
}

// ABI Encoding TS Typess
export type GraphMultiTransferAppState = {
  coinTransfers: CoinTransfer[];
  signerAddress: Address;
  chainId: number;
  verifyingContract: Address;
  subgraphDeploymentID: Bytes32;
  lockedPayment: GraphLockedPayment;
  turnNum: number;
  finalized: boolean;
};

export const GraphActionType = enumify({
    CREATE: "0",
    UNLOCK: "1",
    FINALIZE: "2"
  });

  export type GraphActionType = typeof GraphActionType[keyof typeof GraphActionType];

export type GraphMultiTransferAppAction = {
    actionType: GraphActionType;
    requestCID: Bytes32;
    price: BigNumber;
    responseCID: Bytes32;
    signature: SignatureString;
}

export const graphLockedPaymentEncoding = tidy(`tuple(
    bytes32 requestCID,
    uint256 price
)`)

// ABI Encodings
export const GraphMultiTransferAppStateEncoding = tidy(`tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  address signerAddress,
  uint256 chainId,
  address verifyingContract,
  bytes32 subgraphDeploymentID,
  ${graphLockedPaymentEncoding} lockedPayment,
  uint256 turnNum,
  bool finalized
)`);

export const GraphMultiTransferAppActionEncoding = tidy(`tuple(
  uint8 actionType,
  bytes32 requestCID,
  uint256 price,
  bytes32 responseCID,
  bytes signature
)`);
