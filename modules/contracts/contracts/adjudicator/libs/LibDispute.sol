pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;


/// @title LibDispute
/// @notice Contains the structures and enums needed or generally useful in disputes
contract LibDispute {

    // The status of a challenge in the ChallengeRegistry
    enum ChallengeStatus {
        NO_CHALLENGE,
        IN_DISPUTE,
        IN_ONCHAIN_PROGRESSION,
        EXPLICITLY_FINALIZED
    }

    // State hash with version number and timeout, signed by all parties
    struct SignedAppChallengeUpdate {
        bytes32 appStateHash;
        uint256 versionNumber;
        uint256 timeout;
        bytes[] signatures;
    }

    // Abi-encoded action, with a signature of the turn-taker
    struct SignedAction {
        bytes encodedAction;
        bytes signature;
    }

    // Used to cancel a challenge. Inc. current onchain state hash,
    // challenge status, and signatures on this
    struct SignedCancelChallengeRequest {
        uint256 versionNumber;
        bytes[] signatures;
    }

}
