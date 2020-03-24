import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import { recoverAddress } from "@connext/crypto";
import { BigNumber, hexlify, randomBytes } from "ethers/utils";

export const expect = chai.use(solidity).expect;

export async function sortSignaturesBySignerAddress(
  digest: string,
  signatures: string[],
): Promise<string[]> {
  return (
    await Promise.all(
      signatures.slice().map(async sig => ({ sig, addr: await recoverAddress(digest, sig) })),
    )
  )
    .sort((A, B) => {
      return new BigNumber(A.addr).lt(B.addr) ? -1 : 1;
    })
    .map(x => x.sig);
}

export function createRandomBytesHexString(length: number) {
  return hexlify(randomBytes(length));
}

export function createRandomAddress() {
  return createRandomBytesHexString(20);
}

export function createRandom32ByteHexString() {
  return createRandomBytesHexString(32);
}
