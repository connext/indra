import { EIP712Domain, PrivateKey, Receipt, Address, SignatureString } from "@connext/types";
import { utils } from "ethers";
import { sign, recover } from "eccrypto-js";
import * as bs58 from "bs58";

import { bufferify, getAddressFromPublicKey } from "./crypto";
import { hashDomainSeparator, hashTypedMessage, hashStruct, hashString } from "./eip712";

const { hexlify } = utils;

const RECEIPT_TYPE_HASH = hashString(
  "Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphDeploymentID)",
);

export const hashReceiptData = (receipt: Receipt) =>
  hashStruct(
    RECEIPT_TYPE_HASH,
    ["bytes32", "bytes32", "bytes32"],
    [receipt.requestCID, receipt.responseCID, receipt.subgraphDeploymentID],
  );

export const hashReceiptMessage = (domain: EIP712Domain, receipt: Receipt): string =>
  hashTypedMessage(hashDomainSeparator(domain), hashReceiptData(receipt));

export const signReceiptMessage = async (
  domain: EIP712Domain,
  receipt: Receipt,
  privateKey: PrivateKey,
) =>
  hexlify(await sign(bufferify(privateKey), bufferify(hashReceiptMessage(domain, receipt)), true));

export const recoverAttestationSigner = async (
  domain: EIP712Domain,
  receipt: Receipt,
  sig: SignatureString,
): Promise<Address> =>
  getAddressFromPublicKey(
    hexlify(await recover(bufferify(hashReceiptMessage(domain, receipt)), bufferify(sig))),
  );

export const getTestEIP712Domain = (chainId: number): EIP712Domain => ({
  name: "Graph Protocol",
  version: "0",
  chainId,
  verifyingContract: "0x1d85568eEAbad713fBB5293B45ea066e552A90De",
  salt: "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2",
});

export const getTestReceiptToSign = () => ({
  requestCID: "0xd902c18a1b3590a3d2a8ae4439db376764fda153ca077e339d0427bf776bd463",
  responseCID: "0xbe0b5ae5f598fdf631133571d59ef16b443b2fe02e35ca2cb807158069009db9",
  subgraphDeploymentID: hexlify(
    bs58.decode("QmTXzATwNfgGVukV1fX2T6xw9f6LAYRVWpsdXyRWzUR2H9").slice(2),
  ),
});
