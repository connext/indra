pragma solidity ^0.6.4;
pragma experimental "ABIEncoderV2";

import "./AppWithAction.sol";


/*
 * App with a counter
 * Only participants[1] is allowed to increment it
 */
contract AppComputeOutcomeFails is AppWithAction {
  function computeOutcome(bytes calldata) external override view returns (bytes memory) {
    revert("computeOutcome always fails for this app");
  }
}
