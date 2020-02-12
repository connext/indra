pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "../interfaces/CounterfactualApp.sol";


/*
 * App with a counter
 * Only participants[1] is allowed to increment it
 */


contract AppWithNoApplyAction is CounterfactualApp {

    enum TwoPartyFixedOutcome {
        SEND_TO_ADDR_ONE,
        SEND_TO_ADDR_TWO,
        SPLIT_AND_SEND_TO_BOTH_ADDRS
    }

    enum ActionType { SUBMIT_COUNTER_INCREMENT, ACCEPT_INCREMENT }

    struct State {
        uint256 counter;
    }

    struct Action {
        ActionType actionType;
        uint256 increment;
    }

    /**
     * The 0th signer is allowed to make one nonzero increment at turnNum = 0,
     * after which time the 1st signer may finalize the outcome.
     */
    function getTurnTaker(
        bytes calldata encodedState,
        address[] calldata participants
    )
        external
        pure
        returns (address)
    {
        State memory state = abi.decode(encodedState, (State));
        return participants[state.counter > 0 ? 0 : 1];
    }

    function applyAction(
        bytes calldata encodedState,
        bytes calldata encodedAction
    )
        external
        pure
        returns (bytes memory ret)
    {
        revert("no applyAction for this app");
    }

    function computeOutcome(bytes calldata)
        external
        pure
        returns (bytes memory)
    {
        return abi.encode(TwoPartyFixedOutcome.SEND_TO_ADDR_ONE);
    }

    function isStateTerminal(bytes calldata encodedState)
        external
        pure
        returns (bool)
    {
        State memory state = abi.decode(encodedState, (State));
        return state.counter > 0;
    }

}
