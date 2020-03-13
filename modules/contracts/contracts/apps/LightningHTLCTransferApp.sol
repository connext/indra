pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../adjudicator/interfaces/CounterfactualApp.sol";
import "../funding/libs/LibOutcome.sol";


/// @title Lightning HTLC Transfer App
/// @notice This contract allows users to claim a payment locked in
///         the application if they provide a preimage that corresponds
///         to a lightning hash
contract LightningHTLCTransferApp is CounterfactualApp {

    using SafeMath for uint256;

    /**
    * Assume the app is funded with the money already owed to receiver,
    * as in the SimpleTwoPartySwapApp.
    *
    * This app can also not be used to send _multiple_ hashlocked payments,
    * only one can be redeemed with the preimage.
    *
    */
    struct AppState {
        LibOutcome.CoinTransfer[2] coinTransfers;
        bytes32 lockHash;
        bytes32 preimage;
        uint256 turnNum; // even is receiver?
        bool finalized;
    }

    struct Action {
        bytes32 preimage;
    }

    function applyAction(
        bytes calldata encodedState,
        bytes calldata encodedAction
    )
        external
        pure
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        Action memory action = abi.decode(encodedAction, (Action));

        require(!state.finalized, "Cannot take action on finalized state");
        // TODO feels weird that the initial state and first turn have same turnNum
        require(state.turnNum % 2 == 0, "Payment must be unlocked by receiver");

        state.preimage = action.preimage;
        state.finalized = true;
        state.turnNum += 1;

        return abi.encode(state);
    }

    function computeOutcome(bytes calldata encodedState)
        external
        pure
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        // TODO: whats the protection against passing a different hash?

        bytes32 generatedHash = sha256(abi.encode(state.preimage));

        LibOutcome.CoinTransfer[2] memory transfers;
        if (generatedHash == state.lockHash && state.finalized) {
            /**
             * If the hash is correct, set outcome to provided transfers.
             */
            transfers = LibOutcome.CoinTransfer[2]([
                LibOutcome.CoinTransfer(
                    state.coinTransfers[0].to,
                    /* should always be 0 */
                    0
                ),
                LibOutcome.CoinTransfer(
                    state.coinTransfers[1].to,
                    /* should always be full value of transfer */
                    state.coinTransfers[0].amount
                )
            ]);
        } else {
            /**
             * If the hash is not correct, set outcome to reverted transfers.
             */
            transfers = LibOutcome.CoinTransfer[2]([
                LibOutcome.CoinTransfer(
                    state.coinTransfers[0].to,
                    state.coinTransfers[0].amount
                ),
                LibOutcome.CoinTransfer(
                    state.coinTransfers[1].to,
                    0
                )
            ]);
        }
        return abi.encode(transfers);
    }

    function getTurnTaker(
        bytes calldata encodedState,
        address[] calldata participants // length == 2!
    )
        external
        pure
        returns (address)
    {
        return participants[
            abi.decode(encodedState, (AppState)).turnNum % 2
        ];
    }

    function isStateTerminal(bytes calldata encodedState)
        external
        pure
        returns (bool)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        return state.finalized;
    }
}
