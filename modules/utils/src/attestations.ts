import { PrivateKey, Receipt, Address, SignatureString } from "@connext/types";
import { hexlify, toUtf8Bytes, keccak256, defaultAbiCoder, solidityKeccak256 } from "ethers/utils";
import { sign, concatBuffers, recover } from "eccrypto-js";
import * as bs58 from "bs58";

import { bufferify, getAddressFromPublicKey } from "./crypto";

// EIP-712 TYPE HASH CONSTANTS

const DOMAIN_TYPE_HASH = keccak256(
  toUtf8Bytes(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)",
  ),
);

const RECEIPT_TYPE_HASH = keccak256(
  toUtf8Bytes("Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphID)"),
);

// EIP-712 DOMAIN SEPARATOR CONSTANTS

const DOMAIN_NAME = "Graph Protocol";
const DOMAIN_VERSION = "0";
const DOMAIN_SALT = "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2";

// EIP-712 TYPE DATA METHODS

export const hashStruct = (typeHash: string, types: string[], values: any[]): string =>
  solidityKeccak256(["bytes32", "bytes"], [typeHash, defaultAbiCoder.encode(types, values)]);

export const hashTypedMessage = (domainSeparator: string, message: string): string =>
  keccak256(concatBuffers(bufferify("\x19\x01"), bufferify(domainSeparator), bufferify(message)));

// ATTESTATION ENCODING METHODS

export const encodeDomainSeparator = (chainId: number, verifyingContract: Address) =>
  hashStruct(
    DOMAIN_TYPE_HASH,
    ["string", "string", "uint256", "address", "bytes32"],
    [DOMAIN_NAME, DOMAIN_VERSION, chainId, verifyingContract, DOMAIN_SALT],
  );

export const encodeReceiptData = (receipt: Receipt): string =>
  hashStruct(
    RECEIPT_TYPE_HASH,
    ["bytes32", "bytes32", "bytes32"],
    [receipt.requestCID, receipt.responseCID, receipt.subgraphID],
  );

// SIGN RECEIPT MESSAGE

export const signReceiptMessage = async (
  receipt: Receipt,
  chainId: number,
  verifyingContract: Address,
  privateKey: PrivateKey,
) =>
  hexlify(
    await sign(
      bufferify(privateKey),
      bufferify(
        hashTypedMessage(
          encodeDomainSeparator(chainId, verifyingContract),
          encodeReceiptData(receipt),
        ),
      ),
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
        bufferify(
          hashTypedMessage(
            encodeDomainSeparator(chainId, verifyingContract),
            encodeReceiptData(receipt),
          ),
        ),
        bufferify(sig),
      ),
    ),
  );

// ATTESTATION TEST DATA

export const getTestVerifyingContract = () => "0x1d85568eEAbad713fBB5293B45ea066e552A90De";

export const getTestReceiptToSign = () => ({
  requestCID: "0xd902c18a1b3590a3d2a8ae4439db376764fda153ca077e339d0427bf776bd463",
  responseCID: "0xbe0b5ae5f598fdf631133571d59ef16b443b2fe02e35ca2cb807158069009db9",
  subgraphID: hexlify(bs58.decode("QmTXzATwNfgGVukV1fX2T6xw9f6LAYRVWpsdXyRWzUR2H9").slice(2)),
});
