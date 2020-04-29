import { AppIdentity, ChallengeStatus, CommitmentTarget } from "@connext/types";
import { toBN } from "@connext/utils";
import { BigNumberish, BigNumber, constants, utils } from "ethers";

export * from "./context";

// include all top level utils
export * from "../../utils";

export const randomState = (numBytes: number = 64) => utils.hexlify(utils.randomBytes(numBytes));

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
  return utils.defaultAbiCoder.encode([`tuple(uint256 counter)`], [state]);
}

export function encodeAction(action: AppWithCounterAction) {
  return utils.defaultAbiCoder.encode([`tuple(uint8 actionType, uint256 increment)`], [action]);
}

export function encodeOutcome() {
  return utils.defaultAbiCoder.encode([`uint`], [TwoPartyFixedOutcome.SEND_TO_ADDR_ONE]);
}

// TS version of MChallengeRegistryCore::computeCancelDisputeHash
export const computeCancelDisputeHash = (identityHash: string, versionNumber: BigNumber) =>
  utils.keccak256(
    utils.solidityPack(
      ["uint8", "bytes32", "uint256"],
      [CommitmentTarget.CANCEL_DISPUTE, identityHash, versionNumber],
    ),
  );

// TS version of MChallengeRegistryCore::appStateToHash
export const appStateToHash = (state: string) => utils.keccak256(state);

// TS version of MChallengeRegistryCore::computeAppChallengeHash
export const computeAppChallengeHash = (
  id: string,
  appStateHash: string,
  versionNumber: BigNumberish,
  timeout: number,
) =>
  utils.keccak256(
    utils.solidityPack(
      ["uint8", "bytes32", "bytes32", "uint256", "uint256"],
      [CommitmentTarget.SET_STATE, id, appStateHash, versionNumber, timeout],
    ),
  );

export class AppWithCounterClass {
  get identityHash(): string {
    return utils.keccak256(
      utils.solidityPack(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          this.multisigAddress,
          this.channelNonce,
          utils.keccak256(utils.solidityPack(["address[]"], [this.participants])),
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
  versionNumber: constants.Zero,
  appStateHash: constants.HashZero,
  status: ChallengeStatus.NO_CHALLENGE,
  finalizesAt: constants.Zero,
};
