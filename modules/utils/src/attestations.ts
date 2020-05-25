import { keccak256, toUtf8Bytes, SigningKey, Arrayish, HDNode } from "ethers/utils";
import * as eip712 from "./eip712";

const RECEIPT_TYPE_HASH = keccak256(
  toUtf8Bytes("Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphID)"),
);

export interface Receipt {
  requestCID: string;
  responseCID: string;
  subgraphID: string;
}

const SALT = "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2";

const encodeReceipt = (receipt: Receipt): string =>
  eip712.hashStruct(
    RECEIPT_TYPE_HASH,
    ["bytes32", "bytes32", "bytes32"],
    [receipt.requestCID, receipt.responseCID, receipt.subgraphID],
  );

export interface Attestation {
  requestCID: string;
  responseCID: string;
  subgraphID: string;
  v: number;
  r: string;
  s: string;
}

export const createAttestation = async (
  signer: Arrayish | HDNode.HDNode,
  chainId: number,
  disputeManagerAddress: string,
  receipt: Receipt,
): Promise<Attestation> => {
  let domainSeparator = eip712.domainSeparator({
    name: "Graph Protocol",
    version: "0",
    chainId,
    verifyingContract: disputeManagerAddress,
    salt: SALT,
  });

  let encodedReceipt = encodeReceipt(receipt);
  let message = eip712.encode(domainSeparator, encodedReceipt);
  let messageHash = keccak256(message);
  let signingKey = new SigningKey(signer);
  let { r, s, v } = signingKey.signDigest(messageHash);

  return {
    requestCID: receipt.requestCID,
    responseCID: receipt.responseCID,
    subgraphID: receipt.subgraphID,
    v: v!,
    r,
    s,
  };
};
