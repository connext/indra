pragma solidity 0.6.7;
pragma experimental "ABIEncoderV2";

import "../libs/LibOutcome.sol";


contract TwoPartyFixedOutcomeApp {

    function computeOutcome(bytes calldata)
        external
        view
        returns (bytes memory)
    {
        return abi.encode(
            LibOutcome.TwoPartyFixedOutcome.SPLIT_AND_SEND_TO_BOTH_ADDRS
        );
    }

}
