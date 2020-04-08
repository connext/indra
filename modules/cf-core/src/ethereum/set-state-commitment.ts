import {
  AppIdentity,
  EthereumCommitment,
  HexString,
  MinimalTransaction,
  SetStateCommitmentJSON,
  SignedAppChallengeUpdate,
  toBN,
} from "@connext/types";
import { Interface, keccak256, solidityPack } from "ethers/utils";
import { sortSignaturesBySignerAddress } from "@connext/types";
import { verifyChannelMessage } from "@connext/crypto";

import { ChallengeRegistry } from "../contracts";
import { AppInstance } from "../models";
import { Context } from "../types";
import { appIdentityToHash } from "../utils";

const iface = new Interface(ChallengeRegistry.abi);

export const getSetStateCommitment = (
  context: Context,
  appInstance: AppInstance,
) => new SetStateCommitment(
  context.network.ChallengeRegistry,
  appInstance.identity,
  appInstance.hashOfLatestState,
  appInstance.versionNumber,
  appInstance.stateTimeout,
);

export class SetStateCommitment implements EthereumCommitment {
  constructor(
    public readonly challengeRegistryAddress: string,
    public readonly appIdentity: AppIdentity,
    public readonly appStateHash: string,
    public readonly versionNumber: number, // app nonce
    public readonly stateTimeout: HexString,
    public readonly appIdentityHash: string = appIdentityToHash(appIdentity),
    private participantSignatures: string[] = [],
  ) {}

  get signatures(): string[] {
    return this.participantSignatures;
  }

  set signatures(sigs: string[]) {
    if (sigs.length < 2) {
      throw new Error(
        `Incorrect number of signatures supplied. Expected at least 2, got ${sigs.length}`,
      );
    }
    this.participantSignatures = sigs;
  }

  public encode(): string {
    return solidityPack(
      ["bytes1", "bytes32", "uint256", "uint256", "bytes32"],
      [
        "0x19",
        appIdentityToHash(this.appIdentity),
        this.versionNumber,
        toBN(this.stateTimeout),
        this.appStateHash,
      ],
    );
  }

  public hashToSign(): string {
    return keccak256(this.encode());
  }

  public async getSignedTransaction(): Promise<MinimalTransaction> {
    this.assertSignatures();
    return {
      to: this.challengeRegistryAddress,
      value: 0,
      data: iface.functions.setState.encode([
        this.appIdentity,
        await this.getSignedAppChallengeUpdate(),
      ]),
    };
  }

  public toJson(): SetStateCommitmentJSON {
    return {
      appIdentityHash: this.appIdentityHash,
      appIdentity: this.appIdentity,
      appStateHash: this.appStateHash,
      challengeRegistryAddress: this.challengeRegistryAddress,
      signatures: this.signatures,
      stateTimeout: this.stateTimeout,
      versionNumber: this.versionNumber,
    };
  }

  public static fromJson(json: SetStateCommitmentJSON) {
    return new SetStateCommitment(
      json.challengeRegistryAddress,
      json.appIdentity,
      json.appStateHash,
      json.versionNumber,
      json.stateTimeout,
      json.appIdentityHash,
      json.signatures,
    );
  }

  private async getSignedAppChallengeUpdate(): Promise<SignedAppChallengeUpdate> {
    this.assertSignatures();
    const hash = this.hashToSign();
    return {
      appStateHash: this.appStateHash,
      versionNumber: this.versionNumber,
      timeout: toBN(this.stateTimeout).toNumber(), // this is a *state-specific* timeout (defaults to defaultTimeout)
      signatures: await sortSignaturesBySignerAddress(hash, this.signatures, verifyChannelMessage),
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
