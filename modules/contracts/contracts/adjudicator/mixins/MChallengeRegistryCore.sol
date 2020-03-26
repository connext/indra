pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "../libs/LibAppCaller.sol";
import "../libs/LibDispute.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract MChallengeRegistryCore is LibStateChannelApp, LibAppCaller, LibDispute {

    using SafeMath for uint256;

    // A mapping of appIdentityHash to timeouts
    mapping (bytes32 => uint256) public appTimeouts;

    // A mapping of appIdentityHash to AppChallenge structs which represents
    // the current on-chain status of some particular application's state.
    mapping (bytes32 => LibStateChannelApp.AppChallenge) public appChallenges;

    // A mapping of appIdentityHash to outcomes
    mapping (bytes32 => bytes) public appOutcomes;

    /// @notice Compute a hash of an application's state
    /// @param appState The ABI encoded state
    /// @return A bytes32 hash of the state
    function appStateToHash(
        bytes memory appState
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(appState);
    }

    /// @notice Compute a unique hash for a single instance of an App
    /// @param appIdentity An `AppIdentity` struct that encodes all unique info for an App
    /// @return A bytes32 hash of the AppIdentity
    function appIdentityToHash(
        LibStateChannelApp.AppIdentity memory appIdentity
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(appIdentity.channelNonce, appIdentity.participants)
        );
    }

    /// @notice Compute a unique hash for the state of a channelized app instance
    /// @param identityHash The unique hash of an `AppIdentity`
    /// @param appStateHash The hash of the app state to be signed
    /// @param versionNumber The versionNumber corresponding to the version of the state
    /// @param timeout A dynamic timeout value representing the timeout for this state
    /// @return A bytes32 hash of the RLP encoded arguments
    function computeAppChallengeHash(
        bytes32 identityHash,
        bytes32 appStateHash,
        uint256 versionNumber,
        uint256 timeout
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                byte(0x19),
                identityHash,
                versionNumber,
                timeout,
                appStateHash
            )
        );
    }

    /// @notice Compute a unique hash for an action used in this channel application
    /// @param turnTaker The address of the user taking the action
    /// @param previousState The hash of a state this action is being taken on
    /// @param action The ABI encoded version of the action being taken
    /// @param versionNumber The versionNumber of the state this action is being taken on
    /// @return A bytes32 hash of the arguments
    function computeActionHash(
        address turnTaker,
        bytes32 previousState,
        bytes memory action,
        uint256 versionNumber
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                byte(0x19),
                turnTaker,
                previousState,
                action,
                versionNumber
            )
        );
    }

    /// @notice Checks if an application's state has been finalized by challenge
    /// @param identityHash The unique hash of an `AppIdentity`
    /// @return A boolean indicator
    function isStateFinalized(bytes32 identityHash)
        public
        view
        returns (bool)
    {
        LibStateChannelApp.AppChallenge storage appChallenge = appChallenges[identityHash];

        return (
          (
              appChallenge.status == LibStateChannelApp.ChallengeStatus.IN_DISPUTE &&
              LibStateChannelApp.hasPassed(appChallenge.finalizesAt.add(appTimeouts[identityHash]))
          ) ||
          (
              appChallenge.status == LibStateChannelApp.ChallengeStatus.IN_ONCHAIN_PROGRESSION &&
              LibStateChannelApp.hasPassed(appChallenge.finalizesAt)
          ) ||
          (
              appChallenge.status == LibStateChannelApp.ChallengeStatus.EXPLICITLY_FINALIZED
          )
        );
    }

}
