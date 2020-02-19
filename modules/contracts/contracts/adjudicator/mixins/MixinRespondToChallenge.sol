pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "../libs/LibAppCaller.sol";
import "./MChallengeRegistryCore.sol";


contract MixinRespondToChallenge is LibStateChannelApp, LibAppCaller, MChallengeRegistryCore {

    /// @notice Respond to a challenge with a valid action or a valid higher state
    /// @param appIdentity an AppIdentity object pointing to the app for which there is a challenge to progress
    /// @param appState The ABI encoded latest signed application state
    /// @param action The ABI encoded action the submitter wishes to take
    /// @param actionSignature A bytes string of a single signature by the address of the
    /// participant for which it is their turn to take the submitted `action`
    /// @dev This function is only callable when the application has an open challenge
    function respondToChallenge(
        AppIdentity memory appIdentity,
        SignedAppChallengeUpdateWithAppState memory stateReq,
        SignedAction memory actionReq
    )
        public
    {

        bytes32 identityHash = appIdentityToHash(appIdentity);

        AppChallenge storage challenge = appChallenges[identityHash];

        require(
            isChallengeNotFinalized(challenge.status, challenge.finalizesAt),
            "respondToChallenge called on app not in FINALIZES_AFTER_DEADLINE state"
        );

        require(
            correctKeysSignedAppChallengeUpdate(identityHash, appIdentity.participants, stateReq),
            "Call to respondToChallenge included incorrectly signed state update"
        );

        // if req.versionNumber > challenge.versionNumber, will be trying
        // to progress with setState. if req.versionNumber ==
        // challenge.versionNumber will be trying to progress by using
        // setStateWithAtion
        require(
            stateReq.versionNumber >= challenge.versionNumber,
            "respondToChallenge was called with outdated state"
        );

        // if the app state in the `stateReq` is *not* the current
        // state of the challenge, then it is advancing by several nonces
        // and you DO NOT apply the action

        // NOTE: this logic indicates that if you need to respond to
        // a challenge with an action on a much higher nonced state,
        // you will need to first call `respondToChallenge` with a higher
        // nonced state, then you will need to call `respondToChallenge`
        // with the higher nonce state + valid action
        if (keccak256(stateReq.appState) == challenge.appStateHash) {

          // assert that req.versionNumber == challenge.versionNumber
          require(
            stateReq.versionNumber == challenge.versionNumber,
            "respondToChallenge was called with an incorrect state"
          );

          // assert the turn taker signed the action
          require(
            correctKeySignedTheAction(
                appIdentity.appDefinition,
                appIdentity.participants,
                stateReq,
                actionReq
            ),
            "respondToChallenge called with action signed by incorrect turn taker"
          );

          require(stateReq.timeout > 0, "Timeout must be greater than 0");

          // This should throw an error if reverts
          bytes memory newState = LibAppCaller.applyAction(
              appIdentity.appDefinition,
              stateReq.appState,
              actionReq.encodedAction
          );

          // do not apply the timeout of the challenge update
          // to the resultant state, instead use the default timeout.
          // Doing otherwise could violate the signers intention. For
          // example:
          // Signer may be fine signing a very small timeout for a favorable
          // state. ("I made the last move in this state, so I'll win if i
          // finalized!"). Then counterparty applies an action to it, and now 
          // signer has very little time to react to this potentially
          // unfavorable state. ("Now they made the last move and will win!")
          // instead use the default timeout.
          uint256 finalizesAt = block.number + appIdentity.defaultTimeout;
          require(finalizesAt >= appIdentity.defaultTimeout, "uint248 addition overflow");

          // update the challenge fields dependent on the takeAction
          challenge.finalizesAt = finalizesAt;
          challenge.status = ChallengeStatus.FINALIZES_AFTER_DEADLINE;
          challenge.appStateHash = keccak256(newState);
        } else {
          // advance the state using the setState action (correct sigs
          // on state already asserted)

          // assert that req.versionNumber > challenge.versionNumber
          require(
            stateReq.versionNumber > challenge.versionNumber,
            "respondToChallenge was called with an outdated state"
          );

          uint256 finalizesAt = block.number + stateReq.timeout;
          require(finalizesAt >= stateReq.timeout, "uint248 addition overflow");

          // update the challenge fields dependent on setState
          challenge.status = stateReq.timeout > 0 ? ChallengeStatus.FINALIZES_AFTER_DEADLINE : ChallengeStatus.EXPLICITLY_FINALIZED;
          challenge.appStateHash = keccak256(stateReq.appState);
          challenge.finalizesAt = finalizesAt;
        }

        // update remaining challenge fields
        // should this be +1 in the set state with action case?
        challenge.versionNumber = stateReq.versionNumber;
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
        return verifySignatures(req.signatures, digest, participants);
    }


    function correctKeySignedTheAction(
        address appDefinition,
        address[] memory participants,
        SignedAppChallengeUpdateWithAppState memory req,
        SignedAction memory action
    )
        private
        pure
        returns (bool)
    {
        address turnTaker = LibAppCaller.getTurnTaker(
            appDefinition,
            participants,
            req.appState
        );

        address signer = computeActionHash(
            turnTaker,
            keccak256(req.appState),
            action.encodedAction,
            req.versionNumber
        ).recover(action.signature);

        return turnTaker == signer;
    }
}
