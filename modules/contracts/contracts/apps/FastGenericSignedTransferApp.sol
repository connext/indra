pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../adjudicator/interfaces/CounterfactualApp.sol";
import "../funding/libs/LibOutcome.sol";

/// @title Fast Generic Signed Transfer App
/// @notice This contract allows the user to send transfers
///         using takeAction which are resolves with a sig
///         from a predefined signer

contract FastGenericSignedTransferApp is CounterfactualApp {

    using SafeMath for uint256;

    // Do we need a payment status? An unlocked or rejected payment should be
    // removed from the lockedPayments array entirely

    // enum PaymentStatus {
    //     CREATED,
    //     UNLOCKED,
    //     REJECTED
    // }

    enum ActionType {
        CREATE,
        UNLOCK,
        REJECT,
        FINALIZE
    }

    struct Payment {
        uint256 amount;
        address assetId;
        address signer;
        bytes32 paymentID; // requestCID
        uint256 timeout; // Block height. 0 is special case where there's no timeout.
        // PaymentStatus status;
    }

    struct AppState {
        Payment[] lockedPayments;
        LibOutcome.CoinTransfer[2] transfers; // balances
        bool finalized;
        uint256 turnNum;
    }

    struct Action {
        // sender-supplied
        uint256 amount;
        address assetId;
        address signer;
        bytes32 paymentID; // requestCID
        uint256 timeout; // Block height. 0 is special case where there's no timeout.
        // receiver-supplied
        bytes32 signature;
        bytes32 data; // responseCID
        ActionType actionType;
    }

    function getTurnTaker(
        bytes calldata encodedState,
        address[] calldata participants
    )
        external
        pure
        returns (address)
    {
        return participants[
            abi.decode(encodedState, (AppState)).turnNum % participants.length
        ];
    }

    function isStateTerminal(bytes calldata encodedState)
        external
        pure
        returns (bool)
    {
        return abi.decode(encodedState, (AppState)).finalized;
    }

    function computeOutcome(bytes calldata encodedState)
        external
        pure
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        if (state.finalized) {
            return abi.encode(state.transfers);
        } else {
            revert; // TODO: Revert here? Or do something else?
        }
    }

    function applyAction(
        bytes calldata encodedState,
        bytes calldata encodedAction
    )
        external
        pure
        returns (bytes memory)
    {
        AppState memory state = abi.decode(
            encodedState,
            (AppState)
        );

        Action memory action = abi.decode(
            encodedAction,
            (Action)
        );

        AppState memory postState;

        if (action.actionType == ActionType.CREATE) {
            postState = doCreate(state, action);
        } else if (action.actionType == ActionType.UNLOCK) {
            postState = doUnlock(state, action);
        } else if (action.actionType == ActionType.REJECT) {
            postState = doReject(state, action);
        } else if (action.actionType == ActionType.FINALIZE) {
            postState = doFinalize(state, action);
        }

        postState.turnNum += 1;
        return abi.encode(postState);
    }

    function doCreate(
        AppState memory state,
        Action memory action
    )
        internal
        pure
    {
        
    }

    function doUnlock(
        AppState memory state,
        Action memory action
    )
        internal
        pure
    {
        
    }

    function doReject(
        AppState memory state,
        Action memory action
    )
        internal
        pure
    {
        
    }

    function doFinalize(
        AppState memory state,
        Action memory action
    )
        internal
        pure
    {
        state.finalized == true;
        return state;
    }

    function insert(
        Payment[] lockedPayments
    )
        internal
        pure
    {

    }

    function remove(
        Payment[] lockedPayments
    )
        internal
        pure
    {
        
    }
}