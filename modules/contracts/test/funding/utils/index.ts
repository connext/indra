import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, recoverAddress, arrayify, hexlify, randomBytes } from "ethers/utils";

export const expect = chai.use(solidity).expect;

export async function recoverAddressWithEthers(digest: string, sig: string) {
  return recoverAddress(arrayify(digest), sig);
}

export async function sortSignaturesBySignerAddress(
  digest: string,
  signatures: string[],
): Promise<string[]> {
  return (
    await Promise.all(
      signatures
        .slice()
        .map(async sig => ({ sig, addr: await recoverAddressWithEthers(digest, sig) })),
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
