pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "../libs/LibDispute.sol";
import "./MChallengeRegistryCore.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract MixinProgressState is LibStateChannelApp, LibDispute, MChallengeRegistryCore {

    using SafeMath for uint256;

    /// @notice Respond to a challenge with a valid action
    /// @param appIdentity an AppIdentity object pointing to the app for which there is a challenge to progress
    /// @param appState The ABI encoded latest signed application state
    /// @param action The ABI encoded action the submitter wishes to take and
    /// a single signature by the address of the participant for which it is their turn
    /// to take the submitted `action`
    function progressState(
        AppIdentity memory appIdentity,
        bytes memory appState,
        SignedAction memory action
    )
        public
    {
        bytes32 identityHash = appIdentityToHash(appIdentity);
        AppChallenge storage challenge = appChallenges[identityHash];

        require(
            isProgressable(challenge, appIdentity.defaultTimeout),
            "progressState called on app not in a progressable state"
        );

        bytes32 appStateHash = appStateToHash(appState);

        require(
            appStateHash == challenge.appStateHash,
            "Tried to progress a challenge with non-agreed upon app"
        );

        require(
            correctKeySignedTheAction(
                appIdentity,
                appState,
                appStateHash,
                challenge.versionNumber,
                action
            ),
            "progressState called with action signed by incorrect turn taker"
        );

        // This should throw an error if reverts
        bytes memory newState = applyAction(
            appIdentity.appDefinition,
            appState,
            action.encodedAction
        );

        challenge.status = ChallengeStatus.IN_ONCHAIN_PROGRESSION;
        challenge.latestSubmitter = msg.sender;
        challenge.appStateHash = appStateToHash(newState);
        challenge.versionNumber++;
        challenge.finalizesAt = block.number.add(appIdentity.defaultTimeout);
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
