pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "../libs/LibDispute.sol";
import "../libs/LibAppCaller.sol";
import "./MChallengeRegistryCore.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract MixinSetStateWithAction is LibStateChannelApp, LibDispute, LibAppCaller, MChallengeRegistryCore {

    using SafeMath for uint256;

    /// @notice Create a challenge regarding the latest signed state and immediately after,
    /// performs a unilateral action to update it. The latest signed state must have timeout 0.
    /// @param appIdentity An AppIdentity pointing to the app having its challenge progressed
    /// @param req A struct with the signed state update in it
    /// @param action A struct with the signed action being taken
    /// @dev Note this function is only callable when the challenge is still disputable.
    function setStateWithAction(
        AppIdentity memory appIdentity,
        SignedAppChallengeUpdateWithAppState memory req,
        SignedAction memory action
    )
        public
    {
        bytes32 identityHash = appIdentityToHash(appIdentity);
        AppChallenge storage challenge = appChallenges[identityHash];

        if (challenge.status == ChallengeStatus.NO_CHALLENGE) {
            appTimeouts[identityHash] = appIdentity.defaultTimeout;
        }

        require(
            isDisputable(challenge),
            "setStateWithAction was called on an app that cannot be disputed anymore"
        );

        require(
            correctKeysSignedAppChallengeUpdate(
                identityHash,
                appIdentity.participants,
                req
            ),
            "Call to setStateWithAction included incorrectly signed state update"
        );

        require(
            req.versionNumber > challenge.versionNumber,
            "setStateWithAction was called with outdated state"
        );

        require(
            req.timeout == 0,
            "setStateWithAction was called with a state with non-zero timeout"
        );

        require(
            correctKeySignedTheAction(
                appIdentity,
                req.appState,
                appStateToHash(req.appState),
                req.versionNumber,
                action
            ),
            "setStateWithAction called with action signed by incorrect turn taker"
        );

        bytes memory newState = applyAction(
            appIdentity.appDefinition,
            req.appState,
            action.encodedAction
        );

        /*
        uint256 finalizesAt = block.number.add(req.timeout);

        challenge.finalizesAt = finalizesAt;
        challenge.status = ChallengeStatus.FINALIZES_AFTER_DEADLINE;
        challenge.appStateHash = keccak256(newState);
        challenge.versionNumber = req.versionNumber;
        challenge.latestSubmitter = msg.sender;
        */
    }

    function correctKeysSignedAppChallengeUpdate(
        bytes32 identityHash,
        address[] memory participants,
        SignedAppChallengeUpdateWithAppState memory req
    )
        private
        pure
        returns (bool)
    {
        bytes32 digest = computeAppChallengeHash(
            identityHash,
            appStateToHash(req.appState),
            req.versionNumber,
            req.timeout
        );
        return verifySignatures(
            req.signatures,
            digest,
            participants
        );
    }

    function correctKeySignedTheAction(
        AppIdentity memory appIdentity,
        bytes memory appState,
        bytes32 appStateHash,
        uint256 versionNumber,
        SignedAction memory action
    )
        private
        view
        returns (bool)
    {
        address turnTaker = getTurnTaker(
            appIdentity.appDefinition,
            appIdentity.participants,
            appState
        );

        bytes32 actionHash = computeActionHash(
            turnTaker,
            appStateHash,
            action.encodedAction,
            versionNumber
        );

        address signer = actionHash.recover(action.signature);

        return turnTaker == signer;
    }

}
