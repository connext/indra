import { BigNumber, solidityPack, keccak256 } from "ethers/utils";
import { AppIdentity, CommitmentTarget } from "@connext/types";

export const appIdentityToHash = (appIdentity: AppIdentity): string => {
  return keccak256(
    solidityPack(
      ["address", "uint256", "bytes32", "address", "uint256"],
      [
        appIdentity.multisigAddress,
        appIdentity.channelNonce,
        keccak256(solidityPack(["address[]"], [appIdentity.participants])),
        appIdentity.appDefinition,
        appIdentity.defaultTimeout,
      ],
    ),
  );
};

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
  versionNumber: BigNumber,
  timeout: BigNumber,
) =>
  keccak256(
    solidityPack(
      ["uint8", "bytes32", "bytes32", "uint256", "uint256"],
      [CommitmentTarget.SET_STATE, id, appStateHash, versionNumber, timeout],
    ),
  );
