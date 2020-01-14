pragma solidity 0.5.15;
pragma experimental "ABIEncoderV2";

import "../../adjudicator/interfaces/CounterfactualApp.sol";


contract IdentityApp is CounterfactualApp {

  function computeOutcome(bytes calldata encodedState)
    external
    pure
    returns (bytes memory)
  {
    return encodedState;
  }

}
