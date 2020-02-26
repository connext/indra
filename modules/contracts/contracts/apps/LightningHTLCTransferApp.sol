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

        // TODO: do we need a turntaker here?
        state.preimage = action.preimage;

        return abi.encode(state);
    }

    function computeOutcome(bytes calldata encodedState)
        external
        pure
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        // TODO: whats the protection against passing a different hash?

        bytes32 generatedHash = sha256(state.preimage);

        LibOutcome.CoinTransfer[2] memory transfers;
        if (generatedHash == state.lockHash) {
            /**
             * If the hash is correct, finalize the state with provided transfers.
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
             * If the hash is not correct, finalize the state with reverted transfers.
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
}
