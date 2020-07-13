import {
  AppIdentity,
  CommitmentTarget,
  EthereumCommitment,
  MinimalTransaction,
  SetStateCommitmentJSON,
  SignedAppChallengeUpdate,
} from "@connext/types";
import {
  appIdentityToHash,
  bigNumberifyJson,
  deBigNumberifyJson,
  recoverAddressFromChannelMessage,
} from "@connext/utils";
import { BigNumber, utils } from "ethers";

import * as ChallengeRegistry from "../../artifacts/ChallengeRegistry.json";

const { Interface, keccak256, solidityPack } = utils;

const iface = new Interface(ChallengeRegistry.abi);

export class SetStateCommitment implements EthereumCommitment {
  constructor(
    public readonly challengeRegistryAddress: string,
    public readonly appIdentity: AppIdentity,
    public readonly appStateHash: string,
    public readonly versionNumber: BigNumber,
    public readonly stateTimeout: BigNumber,
    public readonly appIdentityHash: string = appIdentityToHash(appIdentity),
    public transactionData: string = "",
    private initiatorSignature?: string,
    private responderSignature?: string,
  ) {
    this.transactionData = this.transactionData || this.getTransactionData();
  }

  get signatures(): string[] {
    return [this.initiatorSignature!, this.responderSignature!];
  }

  public async addSignatures(
    signature1: string | undefined,
    signature2: string | undefined = undefined,
  ): Promise<void> {
    for (const sig of [signature1, signature2]) {
      if (!sig) {
        continue;
      }
      const recovered = await recoverAddressFromChannelMessage(this.hashToSign(), sig);
      if (recovered === this.appIdentity.participants[0]) {
        this.initiatorSignature = sig;
      } else if (recovered === this.appIdentity.participants[1]) {
        this.responderSignature = sig;
      } else {
        throw new Error(
          `Invalid signer detected. Got ${recovered}, expected one of: ${this.appIdentity.participants}`,
        );
      }
    }

    this.transactionData = this.getTransactionData();
  }

  set signatures(sigs: string[]) {
    throw new Error(`Use "addSignatures" to ensure the correct sorting`);
  }

  public encode(): string {
    return solidityPack(
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
    return keccak256(this.encode());
  }

  private getTransactionData(): string {
    return iface.encodeFunctionData("setState", [
      this.appIdentity,
      this.getSignedAppChallengeUpdate(),
    ]);
  }

  public async getSignedTransaction(): Promise<MinimalTransaction> {
    await this.assertSignatures();
    return {
      to: this.challengeRegistryAddress,
      value: 0,
      data: this.transactionData,
    };
  }

  public toJson(): SetStateCommitmentJSON {
    return deBigNumberifyJson<SetStateCommitmentJSON>({
      appIdentityHash: this.appIdentityHash,
      appIdentity: this.appIdentity,
      appStateHash: this.appStateHash,
      challengeRegistryAddress: this.challengeRegistryAddress,
      signatures: this.signatures,
      stateTimeout: this.stateTimeout,
      transactionData: this.transactionData,
      versionNumber: this.versionNumber,
    });
  }

  public static fromJson(json: SetStateCommitmentJSON) {
    const bnJson = bigNumberifyJson(json);
    const sigs = bnJson.signatures || [bnJson["initiatorSignature"], bnJson["responderSignature"]];
    return new SetStateCommitment(
      bnJson.challengeRegistryAddress,
      bnJson.appIdentity,
      bnJson.appStateHash,
      bnJson.versionNumber,
      bnJson.stateTimeout,
      bnJson.appIdentityHash,
      bnJson.transactionData,
      sigs[0],
      sigs[1],
    );
  }

  public getSignedAppChallengeUpdate(): SignedAppChallengeUpdate {
    return {
      appStateHash: this.appStateHash,
      versionNumber: this.versionNumber,
      timeout: this.stateTimeout, // this is a *state-specific* timeout (defaults to defaultTimeout)
      // safe to do because IFF single signed commitment, then contract
      // will take a single signers array of just the turn taker
      signatures: this.signatures.filter((x) => !!x),
    };
  }

  public async assertSignatures() {
    if (!this.signatures || this.signatures.length === 0) {
      throw new Error(`No signatures detected`);
    }

    for (const [idx, sig] of this.signatures.entries()) {
      if (!sig) {
        // set state commitments may be singly signed if they are going
        // to be used in the `progressState` path
        continue;
      }
      const signer = await recoverAddressFromChannelMessage(this.hashToSign(), sig);
      if (signer !== this.appIdentity.participants[idx]) {
        throw new Error(
          `Got ${signer} and expected ${this.appIdentity.participants[idx]} in set state commitment`,
        );
      }
    }
  }
}
