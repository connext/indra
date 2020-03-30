pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


/// @title LibStateChannelApp
/// @author Liam Horne - <liam@l4v.io>
/// @notice Contains the structures and enums needed for the ChallengeRegistry
contract LibStateChannelApp {

    using ECDSA for bytes32;
    using SafeMath for uint256;

    // The status of a challenge in the ChallengeRegistry
    enum ChallengeStatus {
        NO_CHALLENGE,
        IN_DISPUTE,
        IN_ONCHAIN_PROGRESSION,
        EXPLICITLY_FINALIZED,
        OUTCOME_SET
    }

    // A minimal structure that uniquely identifies a single instance of an App
    struct AppIdentity {
        uint256 channelNonce;
        address[] participants;
        address appDefinition;
        uint256 defaultTimeout;
    }

    // A structure representing the state of a CounterfactualApp instance from the POV of the blockchain
    // NOTE: AppChallenge is the overall state of a channelized app instance,
    // appStateHash is the hash of a state specific to the CounterfactualApp (e.g. chess position)
    struct AppChallenge {
        ChallengeStatus status;
        address latestSubmitter;
        bytes32 appStateHash;
        uint256 versionNumber;
        uint256 finalizesAt;
    }

    // Event emitted when the challenge is updated
    event ChallengeUpdated (
      bytes32 identityHash,
      ChallengeStatus status,
      address latestSubmitter,
      bytes32 appStateHash,
      uint256 versionNumber,
      uint256 finalizesAt
    );

    /// @dev Checks whether the given timeout has passed
    /// @param timeout a timeout as block number
    function hasPassed(
        uint256 timeout
    )
        public
        view
        returns (bool)
    {
        return timeout <= block.number;
    }

    /// @dev Checks whether it is still possible to send all-party-signed states
    /// @param appChallenge the app challenge to check
    function isDisputable(
        AppChallenge memory appChallenge
    )
        public
        view
        returns (bool)
    {
        return appChallenge.status == ChallengeStatus.NO_CHALLENGE ||
            (
                appChallenge.status == ChallengeStatus.IN_DISPUTE &&
                !hasPassed(appChallenge.finalizesAt)
            );
    }

    /// @dev Checks whether it is possible to send actions to progress state
    /// @param appChallenge the app challenge to check
    /// @param defaultTimeout the app instance's default timeout
    function isProgressable(
        AppChallenge memory appChallenge,
        uint256 defaultTimeout
    )
        public
        view
        returns (bool)
    {
        return
            (
                appChallenge.status == ChallengeStatus.IN_DISPUTE &&
                hasPassed(appChallenge.finalizesAt) &&
                !hasPassed(appChallenge.finalizesAt.add(defaultTimeout))
            ) ||
            (
                appChallenge.status == ChallengeStatus.IN_ONCHAIN_PROGRESSION &&
                !hasPassed(appChallenge.finalizesAt)
            );
    }

    /// @dev Verifies signatures given the signer addresses
    /// @param signatures message `txHash` signature
    /// @param txHash operation ethereum signed message hash
    /// @param signers addresses of all signers in order
    function verifySignatures(
        bytes[] memory signatures,
        bytes32 txHash,
        address[] memory signers
    )
        public
        pure
        returns (bool)
    {
        require(
            signers.length == signatures.length,
            "Signers and signatures should be of equal length"
        );
        address lastSigner = address(0);
        for (uint256 i = 0; i < signers.length; i++) {
            require(
                signers[i] == txHash.recover(signatures[i]),
                "Invalid signature"
            );
            require(signers[i] > lastSigner, "Signers not in alphanumeric order");
            lastSigner = signers[i];
        }
        return true;
    }

}
