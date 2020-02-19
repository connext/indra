import { ChallengeJson, ChallengeStatus } from "@connext/types";
import { BigNumber, keccak256, solidityPack, defaultAbiCoder } from "ethers/utils";
import { Memoize } from "typescript-memoize";
import { AppInstance } from "./app-instance";
import { bigNumberifyJson } from "../utils";

/**
 * Representation of a dispute
 *
 * @property status The challenge status
 *
 * @p
 */
export class Challenge {
  constructor(
    private readonly _app: AppInstance,
    private readonly _status: ChallengeStatus,
    private readonly _latestSubmitter: string,
    private readonly _count: BigNumber,
    private readonly _finalizesAt: BigNumber, // date
  ) {}

  @Memoize()
  public get status() {
    return this._status;
  }

  @Memoize()
  public get latestSubmitter() {
    return this._latestSubmitter;
  }

  @Memoize()
  public get app() {
    return this._app;
  }

  @Memoize()
  public get count() {
    return this._count;
  }

  @Memoize()
  public get finalizesAt() {
    return this._finalizesAt;
  }

  @Memoize()
  public get appChallengeHash() {
    // NOTE: computing the app challenge hash in this way
    // assumes that the latest state was used to generate the
    // challenge onchain
    return keccak256(
      solidityPack(
        ["bytes1", "bytes32", "uint256", "uint256", "bytes32"],
        [
          "0x19",
          this.app.identityHash,
          this.app.versionNumber,
          this.app.timeout,
          this.app.hashOfLatestState,
        ],
      ),
    );
  }

  @Memoize()
  public get appIdentityHash() {
    return keccak256(
      defaultAbiCoder.encode(
        ["uint256", "address[]"],
        [this.app.identity.channelNonce, this.app.identity.participants],
      ),
    );
  }

  public toJson(): ChallengeJson {
    return bigNumberifyJson({
      app: this.app.toJson(),
      count: this.count,
      finalizesAt: this.finalizesAt,
      latestSubmitter: this.latestSubmitter,
      status: this.status,
    });
  }

  public static fromJson(json: ChallengeJson): Challenge {
    const deserialized = bigNumberifyJson(json);
    return new Challenge(
      AppInstance.fromJson(deserialized.app),
      deserialized.status,
      deserialized.latestSubmitter,
      deserialized.count,
      deserialized.finalizesAt,
    );
  }
}
