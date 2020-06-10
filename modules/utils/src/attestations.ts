import { PrivateKey, Receipt, Address, SignatureString, Attestation } from "@connext/types";
import { utils } from "ethers";
import { sign, recover } from "eccrypto-js";
import * as bs58 from "bs58";

import { bufferify, getAddressFromPublicKey } from "./crypto";

const { hexlify, keccak256, toUtf8Bytes, defaultAbiCoder, solidityKeccak256 } = utils;

const hashString = (str: string) => keccak256(toUtf8Bytes(str));

const hashTypedMessage = (domainSeparator: string, messageHash: string): string =>
  solidityKeccak256(["string", "bytes32", "bytes32"], ["\x19\x01", domainSeparator, messageHash]);

const hashStruct = (typeHash: string, types: string[], values: any[]) => {
  types.forEach((type, i) => {
    if (["string", "bytes"].includes(type)) {
      types[i] = "bytes32";
      if (type === "string") {
        values[i] = hashString(values[i]);
      } else {
        values[i] = keccak256(values[i]);
      }
    }
  });
  return keccak256(defaultAbiCoder.encode(["bytes32", ...types], [typeHash, ...values]));
};

const DOMAIN_TYPE_HASH = hashString(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)",
);

const RECEIPT_TYPE_HASH = hashString(
  "Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphDeploymentID)",
);

const DOMAIN_NAME = "Graph Protocol";
const DOMAIN_VERSION = "0";
const DOMAIN_SALT = "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2";

export const hashDomainSeparator = (chainId: number, verifyingContract: string) =>
  hashStruct(
    DOMAIN_TYPE_HASH,
    ["string", "string", "uint256", "address", "bytes32"],
    [DOMAIN_NAME, DOMAIN_VERSION, chainId, verifyingContract, DOMAIN_SALT],
  );

export const hashReceiptData = (receipt: Receipt) =>
  hashStruct(
    RECEIPT_TYPE_HASH,
    ["bytes32", "bytes32", "bytes32"],
    [receipt.requestCID, receipt.responseCID, receipt.subgraphDeploymentID],
  );

export const hashReceiptMessage = (
  chainId: number,
  verifyingContract: string,
  receipt: Receipt,
): string =>
  hashTypedMessage(hashDomainSeparator(chainId, verifyingContract), hashReceiptData(receipt));

export const signReceiptMessage = async (
  receipt: Receipt,
  chainId: number,
  verifyingContract: Address,
  privateKey: PrivateKey,
) =>
  hexlify(
    await sign(
      bufferify(privateKey),
      bufferify(hashReceiptMessage(chainId, verifyingContract, receipt)),
      true,
    ),
  );

export const recoverAttestationSigner = async (
  receipt: Receipt,
  chainId: number,
  verifyingContract: Address,
  sig: SignatureString,
): Promise<Address> =>
  getAddressFromPublicKey(
    hexlify(
      await recover(
        bufferify(hashReceiptMessage(chainId, verifyingContract, receipt)),
        bufferify(sig),
      ),
    ),
  );

export const getTestVerifyingContract = () => "0x1d85568eEAbad713fBB5293B45ea066e552A90De";

export const getTestReceiptToSign = () => ({
  requestCID: "0xd902c18a1b3590a3d2a8ae4439db376764fda153ca077e339d0427bf776bd463",
  responseCID: "0xbe0b5ae5f598fdf631133571d59ef16b443b2fe02e35ca2cb807158069009db9",
  subgraphDeploymentID: hexlify(
    bs58.decode("QmTXzATwNfgGVukV1fX2T6xw9f6LAYRVWpsdXyRWzUR2H9").slice(2),
  ),
});
