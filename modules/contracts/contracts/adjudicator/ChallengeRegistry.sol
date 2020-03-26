pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "./mixins/MixinChallengeRegistryCore.sol";
import "./mixins/MixinCancelChallenge.sol";
import "./mixins/MixinSetOutcome.sol";
import "./mixins/MixinSetState.sol";
import "./mixins/MixinSetStateWithAction.sol";
import "./mixins/MixinProgressState.sol";


/// @dev Base contract implementing all logic needed for full-featured App registry
// solium-disable-next-line lbrace
contract ChallengeRegistry is
  MixinChallengeRegistryCore,
  MixinSetState,
  MixinProgressState,
  MixinSetStateWithAction,
  MixinCancelChallenge,
  MixinSetOutcome {
    // solium-disable-next-line no-empty-blocks
    constructor () public {}
}
