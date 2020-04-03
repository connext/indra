pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../adjudicator/interfaces/CounterfactualApp.sol";
import "../state-deposit-holders/MinimumViableMultisig.sol";
import "../libs/LibOutcome.sol";


/// @title Deposit App
/// @notice This contract allows a user to trustlessly deposit into a channel
///         by attributing the difference in value of multisig to the depositor

///         THIS CONTRACT WILL ONLY WORK FOR 2-PARTY CHANNELS!
contract DepositApp is CounterfactualApp {

    address constant CONVENTION_FOR_ETH_TOKEN_ADDRESS = address(0x0);

    struct AppState {
        LibOutcome.CoinTransfer[2] transfers; // both amounts should be 0 in initial state
        address payable multisigAddress;
        address assetId;
        uint256 startingTotalAmountWithdrawn;
        uint256 startingMultisigBalance;
        uint256 timelock;
        bool finalized;
    }

    function getTurnTaker(
        bytes calldata encodedState,
        address[] calldata participants
    )
        external
        view
        returns (address)
    {
        return participants[0];
    }

    function applyAction(
        bytes calldata encodedState,
        bytes calldata encodedAction
    )
        external
        view
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));

        require(!state.finalized, "cannot take action on a finalized state");

        uint256 endingTotalAmountWithdrawn;
        uint256 endingMultisigBalance;

        if (isDeployed(state.multisigAddress)) {
            endingTotalAmountWithdrawn = MinimumViableMultisig(state.multisigAddress).totalAmountWithdrawn(state.assetId);
        } else {
            endingTotalAmountWithdrawn = 0;
        }

        if (state.assetId == CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
            endingMultisigBalance = state.multisigAddress.balance;
        } else {
            endingMultisigBalance = ERC20(state.assetId).balanceOf(state.multisigAddress);
        }

        // NOTE: deliberately do NOT use safemath here. For more info, see: TODO
        state.transfers[0].amount = (endingMultisigBalance - state.startingMultisigBalance) +
            (endingTotalAmountWithdrawn - state.startingTotalAmountWithdrawn);
        state.transfers[1].amount = 0;
        state.finalized = true;

        return abi.encode(state);
    }

    function computeOutcome(bytes calldata encodedState)
        external
        view
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        if (!state.finalized) {
            require(block.number >= state.timelock, "Cannot uninstall unfinalized deposit unless timelock has expired");
        }
        return abi.encode(state.transfers);
    }

    function isDeployed(address _addr)
        internal
        view
    returns (bool)
    {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }
}
