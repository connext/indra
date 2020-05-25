import { PrivateKey, Receipt, SignatureString, Address } from "@connext/types";
import { hexlify, toUtf8Bytes, keccak256 } from "ethers/utils";
import { sign, recover } from "eccrypto-js";

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
