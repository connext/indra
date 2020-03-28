pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "./MChallengeRegistryCore.sol";


contract MixinCancelChallenge is LibStateChannelApp, MChallengeRegistryCore {

    /// @notice Unanimously agree to cancel a challenge
    /// @param appIdentity an AppIdentity object pointing to the app being cancelled
    /// @param req Cancel request, includes signatures on app state hash + current challenge status
    /// @dev Note this function is only callable when the application has an open + progressable challenge
    function cancelChallenge(
        AppIdentity memory appIdentity,
        SignedCancelChallengeRequest memory req
    )
        // TODO: Uncomment when ABIEncoderV2 supports `external`
        //       ref: https://github.com/ethereum/solidity/issues/3199
        // external
        public
    {
        bytes32 identityHash = appIdentityToHash(appIdentity);
        AppChallenge storage challenge = appChallenges[identityHash];

        require(
            challenge.status == req.status,
            "cancelChallenge called with incorrect status"
        );

        require(
            challenge.appStateHash == req.appStateHash,
            "cancelChallenge called with incorrect state"
        );

        require(
            isCancellable(challenge, appIdentity.defaultTimeout),
            "cancelChallenge called on challenge that cannot be cancelled"
        );

        require(
            correctKeysSignedCancelChallengeRequest(
                identityHash,
                appIdentity.participants,
                req
            ),
            "Call to cancelChallenge included incorrectly signed request"
        );

        // update the challenge
        challenge.status = ChallengeStatus.NO_CHALLENGE;
        challenge.latestSubmitter = msg.sender;
        challenge.finalizesAt = 0;
        // reset version number so challenge
        // can go through `setState` again if need be
        challenge.versionNumber = 0;
    }

    function correctKeysSignedCancelChallengeRequest(
        bytes32 identityHash,
        address[] memory participants,
        SignedCancelChallengeRequest memory req
    )
        private
        pure
        returns (bool)
    {
        bytes32 digest = computeCancelChallengeHash(
            identityHash,
            req.appStateHash,
            req.status
        );

        return verifySignatures(req.signatures, digest, participants);
    }
}
