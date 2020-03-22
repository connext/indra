import { AppIdentity } from "@connext/types";
import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  BigNumber,
  BigNumberish,
  defaultAbiCoder,
  joinSignature,
  keccak256,
  recoverAddress,
  SigningKey,
  solidityPack,
  arrayify,
} from "ethers/utils";

export const expect = chai.use(solidity).expect;

// TS version of MChallengeRegistryCore::computeAppChallengeHash
export const computeAppChallengeHash = (
  id: string,
  appStateHash: string,
  versionNumber: BigNumberish,
  timeout: number,
) =>
  keccak256(
    solidityPack(
      ["bytes1", "bytes32", "uint256", "uint256", "bytes32"],
      ["0x19", id, versionNumber, timeout, appStateHash],
    ),
  );

// TS version of MChallengeRegistryCore::computeActionHash
export const computeActionHash = (
  turnTaker: string,
  previousState: string,
  action: string,
  versionNumber: number,
) =>
  keccak256(
    solidityPack(
      ["bytes1", "address", "bytes", "bytes", "uint256"],
      ["0x19", turnTaker, previousState, action, versionNumber],
    ),
  );

export class AppIdentityTestClass {
  get identityHash(): string {
    return keccak256(
      defaultAbiCoder.encode(["uint256", "address[]"], [this.channelNonce, this.participants]),
    );
  }

  get appIdentity(): AppIdentity {
    return {
      participants: this.participants,
      appDefinition: this.appDefinition,
      defaultTimeout: this.defaultTimeout,
      channelNonce: this.channelNonce,
    };
  }

  constructor(
    readonly participants: string[],
    readonly appDefinition: string,
    readonly defaultTimeout: number,
    readonly channelNonce: number,
  ) {}
}

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

/**
 * Signs digest with ethers SigningKey
 *
 * @param signatures An array of etherium signatures
 */
export const signDigestWithEthers = (privateKey: string, digest: string) => {
  const signingKey = new SigningKey(privateKey);
  return joinSignature(signingKey.signDigest(arrayify(digest)));
};
