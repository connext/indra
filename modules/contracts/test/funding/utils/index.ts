import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, recoverAddress } from "ethers/utils";

export const expect = chai.use(solidity).expect;

/**
 * Sorts signatures in ascending order of signer address
 *
 * @param signatures An array of etherium signatures
 */
export function sortSignaturesBySignerAddress(digest: string, signatures: string[]): string[] {
  const ret = signatures.slice();
  ret.sort((sigA, sigB) => {
    const addrA = recoverAddress(digest, sigA);
    const addrB = recoverAddress(digest, sigB);
    return new BigNumber(addrA).lt(addrB) ? -1 : 1;
  });
  return ret;
}
