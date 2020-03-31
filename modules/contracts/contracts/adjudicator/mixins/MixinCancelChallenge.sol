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

        require(
            req.versionNumber == challenge.versionNumber,
            "cancelChallenge was called with wrong version number"
        );

        // Clear challenge
        challenge.status = ChallengeStatus.NO_CHALLENGE;
        challenge.latestSubmitter = address(0x0);
        challenge.appStateHash = 0;
        challenge.versionNumber = 0;
        challenge.finalizesAt = 0;
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
            req.versionNumber
        );

        return verifySignatures(
            req.signatures,
            digest,
            participants
        );
    }

}
