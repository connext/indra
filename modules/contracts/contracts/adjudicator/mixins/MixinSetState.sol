pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "./MChallengeRegistryCore.sol";


contract MixinSetState is LibStateChannelApp, MChallengeRegistryCore {

    /// @notice Set the instance state/AppChallenge to a given value.
    /// This value must have been signed off by all parties to the channel, that is,
    /// this must be called with the correct msg.sender (the state deposit holder)
    /// or signatures must be provided.
    /// @param appIdentity an AppIdentity struct with all information encoded within
    ///        it to represent which particular app is having state submitted
    /// @param req An object containing the update to be applied to the
    ///        applications state including the signatures of the users needed
    /// @dev This function is only callable when the state channel is not in challenge
    function setState(
        AppIdentity memory appIdentity,
        SignedAppChallengeUpdateWithAppState memory req
    )
        public
    {
        bytes32 identityHash = appIdentityToHash(appIdentity);

        AppChallenge storage challenge = appChallenges[identityHash];

        // enforce that the challenge is either non existent or ready
        // to be reset, allows the same app to be challenged multiple
        // times in the case of long-lived applications
        require(
            challenge.status == ChallengeStatus.NO_CHALLENGE || challenge.status == ChallengeStatus.OUTCOME_SET,
            "setState was called on an app that already has an active challenge"
        );

        require(
            correctKeysSignedAppChallengeUpdate(
                identityHash,
                appIdentity.participants,
                req
            ),
            "Call to setState included incorrectly signed state update"
        );

        // will just enforce the req.versionNumber is gte zero
        // (can dispute the initial state) or whatever the state after
        // a dispute completes can be re-disputed
        require(
            req.versionNumber > challenge.versionNumber || req.versionNumber == 0,
            "Tried to call setState with an outdated versionNumber version"
        );

        uint256 finalizesAt = block.number + req.timeout;
        require(finalizesAt >= req.timeout, "uint248 addition overflow");

        challenge.status = req.timeout > 0 ? ChallengeStatus.FINALIZES_AFTER_DEADLINE : ChallengeStatus.EXPLICITLY_FINALIZED;
        challenge.appStateHash = keccak256(req.appState);
        challenge.versionNumber = req.versionNumber;
        challenge.finalizesAt = finalizesAt;
        challenge.challengeCounter += 1;
        challenge.latestSubmitter = msg.sender;
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
            keccak256(req.appState),
            req.versionNumber,
            req.timeout
        );

        return verifySignatures(
            req.signatures,
            digest,
            participants
        );
    }

}
