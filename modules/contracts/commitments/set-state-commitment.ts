import {
  AppIdentity,
  BigNumber,
  CommitmentTarget,
  EthereumCommitment,
  MinimalTransaction,
  SetStateCommitmentJSON,
  SignedAppChallengeUpdate,
} from "@connext/types";
import {
  bigNumberifyJson,
  deBigNumberifyJson,
  recoverAddressFromChannelMessage,
  appIdentityToHash,
} from "@connext/utils";
import { utils } from "ethers";

import * as ChallengeRegistry from "../build/ChallengeRegistry.json";
const iface = new utils.Interface(ChallengeRegistry.abi);

export class SetStateCommitment implements EthereumCommitment {
  constructor(
    public readonly challengeRegistryAddress: string,
    public readonly appIdentity: AppIdentity,
    public readonly appStateHash: string,
    public readonly versionNumber: BigNumber,
    public readonly stateTimeout: BigNumber,
    public readonly appIdentityHash: string = appIdentityToHash(appIdentity),
    private initiatorSignature?: string,
    private responderSignature?: string,
  ) {}

  get signatures(): string[] {
    return [this.initiatorSignature!, this.responderSignature!];
  }

  public async addSignatures(
    initiatorSignature: string | undefined,
    responderSignature: string | undefined,
  ): Promise<void> {
    this.initiatorSignature = initiatorSignature;
    this.responderSignature = responderSignature;
  }

  set signatures(sigs: string[]) {
    throw new Error(`Use "addSignatures" to ensure the correct sorting`);
  }

  public encode(): string {
    return utils.solidityPack(
      ["uint8", "bytes32", "bytes32", "uint256", "uint256"],
      [
        CommitmentTarget.SET_STATE,
        appIdentityToHash(this.appIdentity),
        this.appStateHash,
        this.versionNumber,
        this.stateTimeout,
      ],
    );
  }

  public hashToSign(): string {
    return utils.keccak256(this.encode());
  }

  public async getSignedTransaction(): Promise<MinimalTransaction> {
    await this.assertSignatures();
    return {
      to: this.challengeRegistryAddress,
      value: 0,
      data: iface.encodeFunctionData("setState", [
        this.appIdentity,
        await this.getSignedAppChallengeUpdate(),
      ]),
    };
  }

  public toJson(): SetStateCommitmentJSON {
    return deBigNumberifyJson({
      appIdentityHash: this.appIdentityHash,
      appIdentity: this.appIdentity,
      appStateHash: this.appStateHash,
      challengeRegistryAddress: this.challengeRegistryAddress,
      signatures: this.signatures,
      stateTimeout: this.stateTimeout,
      versionNumber: this.versionNumber,
    });
  }

  public static fromJson(json: SetStateCommitmentJSON) {
    const bnJson = bigNumberifyJson(json);
    return new SetStateCommitment(
      bnJson.challengeRegistryAddress,
      bnJson.appIdentity,
      bnJson.appStateHash,
      bnJson.versionNumber,
      bnJson.stateTimeout,
      bnJson.appIdentityHash,
      bnJson.signatures[0],
      bnJson.signatures[1],
    );
  }

  public async getSignedAppChallengeUpdate(): Promise<SignedAppChallengeUpdate> {
    await this.assertSignatures();
    return {
      appStateHash: this.appStateHash,
      versionNumber: this.versionNumber,
      timeout: this.stateTimeout, // this is a *state-specific* timeout (defaults to defaultTimeout)
      signatures: this.signatures,
    };
  }

  private async assertSignatures() {
    if (!this.signatures || this.signatures.length === 0) {
      throw new Error(`No signatures detected`);
    }

    for (const idx in this.signatures) {
      if (!this.signatures[idx]) {
        // set state commitments may be singly signed if they are going
        // to be used in the `progressState` path
        continue;
      }
      const signer = await recoverAddressFromChannelMessage(
        this.hashToSign(),
        this.signatures[idx],
      );
      if (signer !== this.appIdentity.participants[idx]) {
        throw new Error(
          `Got ${signer} and expected ${this.appIdentity.participants[idx]} in set state commitment`,
        );
      }
    }
  }
}
