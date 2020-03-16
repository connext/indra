pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;


/// @title LibDispute
/// @notice Contains the structures and enums needed or generally useful in disputes
contract LibDispute {

    // State hash with version number and timeout, signed by all parties
    struct SignedAppChallengeUpdate {
        bytes32 appStateHash;
        uint256 versionNumber;
        uint256 timeout;
        bytes[] signatures;
    }

    // Abi-encoded state with version number and timeout, signed by all parties
    struct SignedAppChallengeUpdateWithAppState {
        bytes appState;
        uint256 versionNumber;
        uint256 timeout;
        bytes[] signatures;
    }

    // Abi-encoded action, with a signature of the turn-taker
    struct SignedAction {
        bytes encodedAction;
        bytes signature;
    }
}
