import { BigNumber, utils } from "ethers";
import { CommitmentTarget } from "@connext/types";

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
  versionNumber: BigNumber,
  timeout: BigNumber,
) =>
  utils.keccak256(
    utils.solidityPack(
      ["uint8", "bytes32", "bytes32", "uint256", "uint256"],
      [CommitmentTarget.SET_STATE, id, appStateHash, versionNumber, timeout],
    ),
  );
