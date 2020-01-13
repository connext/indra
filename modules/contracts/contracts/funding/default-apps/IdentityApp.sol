pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

/* solium-disable-next-line */
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
