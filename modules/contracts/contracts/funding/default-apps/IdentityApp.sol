pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../../adjudicator/interfaces/CounterfactualApp.sol";


contract IdentityApp is CounterfactualApp {

    function init(bytes calldata encodedState)
        external
        view
        returns(bool)
    {
        return true;
    }

    function computeOutcome(bytes calldata encodedState)
        external
        view
        returns (bytes memory)
    {
        return encodedState;
    }

}
