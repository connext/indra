import { PrivateKey, GraphReceipt, Address, SignatureString, HexString } from "@connext/types";
import { utils, BigNumber } from "ethers";
import { sign, recover } from "eccrypto-js";
import * as bs58 from "bs58";

import { bufferify, getAddressFromPublicKey } from "./crypto";
import { hashString, hashStruct, hashTypedMessage, hashDomainSeparator } from "./eip712";

const { hexlify } = utils;

export const GRAPH_RECEIPT_TYPE_HASH = hashString(
  "Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphDeploymentID)",
);

export const GRAPH_CONSUMER_TYPE_HASH = hashString(
  "Consumer(bytes32 appIdentityHash,bytes32 requestCID,uint256 totalPaid)",
);

const DOMAIN_NAME = "Graph Protocol";
const DOMAIN_VERSION = "0";
const DOMAIN_SALT = "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2";

export const hashGraphReceiptData = (receipt: GraphReceipt) =>
  hashStruct(
    GRAPH_RECEIPT_TYPE_HASH,
    ["bytes32", "bytes32", "bytes32"],
    [receipt.requestCID, receipt.responseCID, receipt.subgraphDeploymentID],
  );

export const hashGraphConsumerData = (
  receipt: GraphReceipt,
  totalPaid: BigNumber,
  appIdentityHash: string,
) =>
  hashStruct(
    GRAPH_CONSUMER_TYPE_HASH,
    ["bytes32", "bytes32", "uint256"],
    [appIdentityHash, receipt.requestCID, totalPaid],
  );

export const hashGraphReceiptMessage = (
  hashGraphReceiptMessage: number,
  verifyingContract: string,
  receipt: GraphReceipt,
): string =>
  hashTypedMessage(
    hashDomainSeparator({
      chainId: hashGraphReceiptMessage,
      name: DOMAIN_NAME,
      salt: DOMAIN_SALT,
      verifyingContract,
      version: DOMAIN_VERSION,
    }),
    hashGraphReceiptData(receipt),
  );

export const signGraphReceiptMessage = async (
  receipt: GraphReceipt,
  chainId: number,
  verifyingContract: Address,
  privateKey: PrivateKey,
) =>
  hexlify(
    await sign(
      bufferify(privateKey),
      bufferify(hashGraphReceiptMessage(chainId, verifyingContract, receipt)),
      true,
    ),
  );

export const recoverGraphAttestationSigner = async (
  receipt: GraphReceipt,
  chainId: number,
  verifyingContract: Address,
  sig: SignatureString,
): Promise<Address> =>
  getAddressFromPublicKey(
    hexlify(
      await recover(
        bufferify(hashGraphReceiptMessage(chainId, verifyingContract, receipt)),
        bufferify(sig),
      ),
    ),
  );

export const hashGraphConsumerMessage = (
  hashGraphConsumerMessage: number,
  verifyingContract: string,
  receipt: GraphReceipt,
  totalPaid: BigNumber,
  appIdentityHash: string,
): string =>
  hashTypedMessage(
    hashDomainSeparator({
      chainId: hashGraphConsumerMessage,
      name: DOMAIN_NAME,
      salt: DOMAIN_SALT,
      verifyingContract,
      version: DOMAIN_VERSION,
    }),
    hashGraphConsumerData(receipt, totalPaid, appIdentityHash),
  );

export const signGraphConsumerMessage = async (
  receipt: GraphReceipt,
  chainId: number,
  verifyingContract: Address,
  totalPaid: BigNumber,
  appIdentityHash: string,
  privateKey: PrivateKey,
) =>
  hexlify(
    await sign(
      bufferify(privateKey),
      bufferify(
        hashGraphConsumerMessage(chainId, verifyingContract, receipt, totalPaid, appIdentityHash),
      ),
      true,
    ),
  );

export const getTestVerifyingContract = () => "0x1d85568eEAbad713fBB5293B45ea066e552A90De";

export const getTestGraphReceiptToSign = () => ({
  requestCID: "0xd902c18a1b3590a3d2a8ae4439db376764fda153ca077e339d0427bf776bd463",
  responseCID: "0xbe0b5ae5f598fdf631133571d59ef16b443b2fe02e35ca2cb807158069009db9",
  subgraphDeploymentID: hexlify(
    bs58.decode("QmTXzATwNfgGVukV1fX2T6xw9f6LAYRVWpsdXyRWzUR2H9").slice(2),
  ),
});

export const getTestGraphDomainSeparator = () => ({
  requestCID: "0xd902c18a1b3590a3d2a8ae4439db376764fda153ca077e339d0427bf776bd463",
  responseCID: "0xbe0b5ae5f598fdf631133571d59ef16b443b2fe02e35ca2cb807158069009db9",
  subgraphDeploymentID: hexlify(
    bs58.decode("QmTXzATwNfgGVukV1fX2T6xw9f6LAYRVWpsdXyRWzUR2H9").slice(2),
  ),
});
