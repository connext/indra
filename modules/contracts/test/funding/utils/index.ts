import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import { recoverAddress } from "@connext/crypto";
import { BigNumber } from "ethers/utils";

export const expect = chai.use(solidity).expect;

/**
 * Sorts signatures in ascending order of signer address
 *
 * @param signatures An array of ethereum signatures
 */
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
