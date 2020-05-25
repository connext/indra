import { PrivateKey, Receipt, SignatureString, Address } from "@connext/types";
import { hexlify, toUtf8Bytes, keccak256 } from "ethers/utils";
import { sign, recover } from "eccrypto-js";
import * as bs58 from "bs58";

import * as eip712 from "./eip712";
import { bufferify, getAddressFromPublicKey } from "./crypto";

// EIP-712 DOMAIN SEPARATOR CONSTANTS

const DOMAIN_NAME = "Graph Protocol";
const DOMAIN_VERSION = "0";
const DOMAIN_SALT = "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2";

// EIP-712 RECEIPT HASH CONSTANT

const RECEIPT_TYPE_HASH = keccak256(
  toUtf8Bytes("Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphID)"),
);

export const getTestVerifyingContract = () => "0x1d85568eEAbad713fBB5293B45ea066e552A90De";

export const getTestReceiptToSign = () => ({
  requestCID: "0xd902c18a1b3590a3d2a8ae4439db376764fda153ca077e339d0427bf776bd463",
  responseCID: "0xbe0b5ae5f598fdf631133571d59ef16b443b2fe02e35ca2cb807158069009db9",
  subgraphID: hexlify(bs58.decode("QmTXzATwNfgGVukV1fX2T6xw9f6LAYRVWpsdXyRWzUR2H9").slice(2)),
});

export const encodeDomainSeparator = (chainId: number, verifyingContract: Address) =>
  eip712.domainSeparator({
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId,
    verifyingContract,
    salt: DOMAIN_SALT,
  });

export const encodeReceipt = (receipt: Receipt): string =>
  eip712.hashStruct(
    RECEIPT_TYPE_HASH,
    ["bytes32", "bytes32", "bytes32"],
    [receipt.requestCID, receipt.responseCID, receipt.subgraphID],
  );

export const hashReceipt = (receipt: Receipt, chainId: number, verifyingContract: Address) =>
  keccak256(
    eip712.encode(encodeDomainSeparator(chainId, verifyingContract), encodeReceipt(receipt)),
  );

export const signReceipt = async (
  receipt: Receipt,
  chainId: number,
  verifyingContract: Address,
  privateKey: PrivateKey,
) =>
  hexlify(
    await sign(
      bufferify(privateKey),
      bufferify(hashReceipt(receipt, chainId, verifyingContract)),
      true,
    ),
  );

export const recoverAddressFromAttestation = async (
  chainId: number,
  verifyingContract: Address,
  receipt: Receipt,
  sig: SignatureString,
): Promise<Address> =>
  getAddressFromPublicKey(
    hexlify(
      await recover(bufferify(hashReceipt(receipt, chainId, verifyingContract)), bufferify(sig)),
    ),
  );
