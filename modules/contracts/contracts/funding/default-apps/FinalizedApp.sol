pragma solidity 0.6.7;
pragma experimental "ABIEncoderV2";

import "./IdentityApp.sol";


contract FinalizedApp is IdentityApp {

    function isStateTerminal(bytes calldata)
        external
        view
        returns (bool)
    {
        return true;
    }

}
