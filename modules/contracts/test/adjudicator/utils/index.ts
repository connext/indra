import { AppIdentity } from "@connext/types";
import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import {
  BigNumber,
  BigNumberish,
  defaultAbiCoder,
  keccak256,
  recoverAddress,
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
