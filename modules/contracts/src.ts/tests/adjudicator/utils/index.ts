import { AppIdentity, ChallengeStatus, CommitmentTarget } from "@connext/types";
import { toBN } from "@connext/utils";
import {
  BigNumberish,
  defaultAbiCoder,
  keccak256,
  hexlify,
  randomBytes,
  solidityPack,
  BigNumber,
} from "ethers/utils";

import { Zero, HashZero } from "ethers/constants";
export * from "./context";

// include all top level utils
export * from "../../utils";

export const randomState = (numBytes: number = 64) => hexlify(randomBytes(numBytes));

// App State With Action types for testing
export type AppWithCounterState = {
  counter: BigNumber;
};

export enum ActionType {
  SUBMIT_COUNTER_INCREMENT,
  ACCEPT_INCREMENT,
}

export enum TwoPartyFixedOutcome {
  SEND_TO_ADDR_ONE,
  SEND_TO_ADDR_TWO,
  SPLIT_AND_SEND_TO_BOTH_ADDRS,
}

export type AppWithCounterAction = {
  actionType: ActionType;
  increment: BigNumber;
};

export function encodeState(state: AppWithCounterState) {
  return defaultAbiCoder.encode([`tuple(uint256 counter)`], [state]);
}

export function encodeAction(action: AppWithCounterAction) {
  return defaultAbiCoder.encode([`tuple(uint8 actionType, uint256 increment)`], [action]);
}

export function encodeOutcome() {
  return defaultAbiCoder.encode([`uint`], [TwoPartyFixedOutcome.SEND_TO_ADDR_ONE]);
}

// TS version of MChallengeRegistryCore::computeCancelDisputeHash
export const computeCancelDisputeHash = (identityHash: string, versionNumber: BigNumber) =>
  keccak256(
    solidityPack(
      ["uint8", "bytes32", "uint256"],
      [CommitmentTarget.CANCEL_DISPUTE, identityHash, versionNumber],
    ),
  );

// TS version of MChallengeRegistryCore::appStateToHash
export const appStateToHash = (state: string) => keccak256(state);

// TS version of MChallengeRegistryCore::computeAppChallengeHash
export const computeAppChallengeHash = (
  id: string,
  appStateHash: string,
  versionNumber: BigNumberish,
  timeout: number,
) =>
  keccak256(
    solidityPack(
      ["uint8", "bytes32", "bytes32", "uint256", "uint256"],
      [CommitmentTarget.SET_STATE, id, appStateHash, versionNumber, timeout],
    ),
  );

export class AppWithCounterClass {
  get identityHash(): string {
    return keccak256(
      solidityPack(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          this.multisigAddress,
          this.channelNonce,
          keccak256(solidityPack(["address[]"], [this.participants])),
          this.appDefinition,
          this.defaultTimeout,
        ],
      ),
    );
  }

  get appIdentity(): AppIdentity {
    return {
      participants: this.participants,
      multisigAddress: this.multisigAddress,
      appDefinition: this.appDefinition,
      defaultTimeout: toBN(this.defaultTimeout),
      channelNonce: toBN(this.channelNonce),
    };
  }

  constructor(
    readonly participants: string[],
    readonly multisigAddress: string,
    readonly appDefinition: string,
    readonly defaultTimeout: number,
    readonly channelNonce: number,
  ) {}
}

export const EMPTY_CHALLENGE = {
  versionNumber: Zero,
  appStateHash: HashZero,
  status: ChallengeStatus.NO_CHALLENGE,
  finalizesAt: Zero,
};
