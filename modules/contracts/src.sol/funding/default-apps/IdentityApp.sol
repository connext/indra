pragma solidity ^0.6.4;
pragma experimental "ABIEncoderV2";

import "../../adjudicator/interfaces/CounterfactualApp.sol";


contract IdentityApp is CounterfactualApp {
  function computeOutcome(bytes calldata encodedState)
    external
    virtual
    override
    view
    returns (bytes memory)
  {
    return encodedState;
  }
}
