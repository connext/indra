pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../libs/LibDispute.sol";
import "./MixinSetState.sol";
import "./MixinProgressState.sol";


contract MixinSetAndProgressState is LibDispute, MixinSetState, MixinProgressState {

    /// @notice Create a challenge regarding the latest signed state and immediately after,
    /// performs a unilateral action to update it. The latest signed state must have timeout 0.
    /// @param appIdentity An AppIdentity pointing to the app having its challenge progressed
    /// @param req A struct with the signed state update in it
    /// @param action A struct with the signed action being taken
    /// @dev Note this function is only callable when the challenge is still disputable.
    function setAndProgressState(
        AppIdentity memory appIdentity,
        SignedAppChallengeUpdate memory req,
        bytes memory appState,
        SignedAction memory action
    )
        public
    {
        setState(
            appIdentity,
            req
        );

        progressState(
            appIdentity,
            appState,
            action
        );

        // Maybe TODO:
        // This can be made slightly more efficient by doing _directly_
        // what these two functions do and leaving out unnecessary parts
        // like the intermediate storing of the challenge (before the
        // action has been applied to it) and skipping tests we know
        // must be true.
        // For now, this is the easiest and most convenient way, though.
    }

}
