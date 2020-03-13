import { Interface, joinSignature, keccak256, Signature, solidityPack } from "ethers/utils";

import { ChallengeRegistry } from "../contracts";
import { AppInstance } from "../models";
import {
  AppIdentity,
  MinimalTransaction,
  Context,
  EthereumCommitment,
  SignedStateHashUpdate,
  SetStateCommitmentJSON,
} from "../types";
import { appIdentityToHash, sortSignaturesBySignerAddress } from "../utils";

const iface = new Interface(ChallengeRegistry.abi);

export const getSetStateCommitment = (
  context: Context,
  appInstance: AppInstance,
) => new SetStateCommitment(
  context.network.ChallengeRegistry,
  appInstance.identity,
  appInstance.hashOfLatestState,
  appInstance.versionNumber,
  appInstance.timeout,
);

export class SetStateCommitment extends EthereumCommitment {
  constructor(
    public readonly challengeRegistryAddress: string,
    public readonly appIdentity: AppIdentity,
    public readonly appStateHash: string,
    public readonly versionNumber: number, // app nonce
    public readonly timeout: number,
    public readonly appIdentityHash: string = appIdentityToHash(appIdentity),
    private participantSignatures: Signature[] = [],
  ) {
    super();
  }

  get signatures(): Signature[] {
    return this.participantSignatures;
  }

  set signatures(sigs: Signature[]) {
    if (sigs.length < 2) {
      throw new Error(
        `Incorrect number of signatures supplied. Expected at least 2, got ${sigs.length}`,
      );
    }
    this.participantSignatures = sigs;
  }

  public hashToSign(): string {
    return keccak256(
      solidityPack(
        ["bytes1", "bytes32", "uint256", "uint256", "bytes32"],
        [
          "0x19",
          appIdentityToHash(this.appIdentity),
          this.versionNumber,
          this.timeout,
          this.appStateHash,
        ],
      ),
    );
  }

  public getSignedTransaction(): MinimalTransaction {
    this.assertSignatures();
    return {
      to: this.challengeRegistryAddress,
      value: 0,
      data: iface.functions.setState.encode([this.appIdentity, this.getSignedStateHashUpdate()]),
    };
  }

  public toJson(): SetStateCommitmentJSON {
    return {
      appIdentityHash: this.appIdentityHash,
      appIdentity: this.appIdentity,
      appStateHash: this.appStateHash,
      challengeRegistryAddress: this.challengeRegistryAddress,
      signatures: this.signatures,
      timeout: this.timeout,
      versionNumber: this.versionNumber,
    };
  }

  public static fromJson(json: SetStateCommitmentJSON) {
    return new SetStateCommitment(
      json.challengeRegistryAddress,
      json.appIdentity,
      json.appStateHash,
      json.versionNumber,
      json.timeout,
      json.appIdentityHash,
      json.signatures,
    );
  }

  private getSignedStateHashUpdate(): SignedStateHashUpdate {
    this.assertSignatures();
    return {
      appStateHash: this.appStateHash,
      versionNumber: this.versionNumber,
      timeout: this.timeout,
      signatures: sortSignaturesBySignerAddress(this.hashToSign(), this.signatures).map(
        joinSignature,
      ),
    };
  }

  private assertSignatures() {
    if (!this.signatures || this.signatures.length === 0) {
      throw new Error(`No signatures detected`);
    }

    if (this.signatures.length < 2) {
      throw new Error(
        `Incorrect number of signatures supplied. Expected at least 2, got ${this.signatures.length}`,
      );
    }
  }
}
