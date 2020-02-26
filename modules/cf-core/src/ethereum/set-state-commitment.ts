import { Interface, joinSignature, keccak256, Signature, solidityPack } from "ethers/utils";

import { ChallengeRegistry } from "../contracts";
import {
  AppIdentity,
  CFCoreTypes,
  EthereumCommitment,
  SignedStateHashUpdate,
  SetStateCommitmentJSON,
} from "../types";
import { sortSignaturesBySignerAddress } from "../utils";

import { appIdentityToHash } from "./utils/app-identity";

const iface = new Interface(ChallengeRegistry.abi);

export class SetStateCommitment extends EthereumCommitment {
  constructor(
    public readonly challengeRegistryAddress: string,
    public readonly appIdentity: AppIdentity,
    public readonly appStateHash: string,
    public readonly versionNumber: number, // app nonce
    public readonly timeout: number,
    private participantSignatures: Signature[] = [],
  ) {
    super();
  }

  get signatures(): Signature[] {
    return this.participantSignatures;
  }

  set signatures(sigs: Signature[]) {
    if (sigs.length !== 2) {
      throw new Error(`Incorrect number of signatures supplied. Expected 2, got ${sigs.length}`);
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

  public getSignedTransaction(): CFCoreTypes.MinimalTransaction {
    this.assertSignatures();
    return {
      to: this.challengeRegistryAddress,
      value: 0,
      data: iface.functions.setState.encode([this.appIdentity, this.getSignedStateHashUpdate()]),
    };
  }

  public toJson(): SetStateCommitmentJSON {
    return {
      appIdentity: this.appIdentity,
      appStateHash: this.appStateHash,
      challengeRegistryAddress: this.challengeRegistryAddress,
      participantSignatures: this.signatures,
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
      json.participantSignatures,
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

    if (this.signatures.length !== 2) {
      throw new Error(
        `Incorrect number of signatures supplied. Expected 2, got ${this.signatures.length}`,
      );
    }
  }
}
