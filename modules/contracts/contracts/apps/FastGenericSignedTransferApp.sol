pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../adjudicator/interfaces/CounterfactualApp.sol";
import "../funding/libs/LibOutcome.sol";

/// @title Fast Generic Signed Transfer App
/// @notice This contract allows the user to send transfers
///         using takeAction which are resolves with a sig
///         from a predefined signer

contract FastGenericSignedTransferApp is CounterfactualApp {

    using SafeMath for uint256;
    using ECDSA for bytes32;

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
        bytes32 paymentID;
        uint256 timeout; // Block height. 0 is special case where there's no timeout.
        address recipient;
        bytes32 data;
        bytes signature;
    }

    struct AppState {
        Payment[] lockedPayments; // TODO: should this be a fixed size array? What happens with many locked payments in a dispute?
        LibOutcome.CoinTransfer[2] transfers; // balances
        bool finalized;
        uint256 turnNum;
    }

    struct Action {
        Payment newLockedPayments; // TODO: turn this into an array
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
            revert("State is not finalized. Please finalize before uninstalling");
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
        require(state.turnNum % 2 == 0);
        require(action.newLockedPayment.paymentID != "" && action.newLockedPayment.paymentID != 0, "PaymentID cannot be 0 or empty string");
        require(find(state.lockedPayments, action.paymentID) == 0, "Locked payment with this paymentID already exists.");
        
        require(action.newLockedPayment.amount <= state.transfers[0].amount);
        state.transfers[0].amount = state.transfers[0].amount.sub(action.newLockedPayment.amount);

        return insert(state.lockedPayments, action.newLockedPayment);
    }

    function doUnlock(
        AppState memory state,
        Action memory action
    )
        internal
        pure
    {
        require(state.turnNum % 2 == 1);
        require(action.paymentID != "" && action.paymentID != 0, "PaymentID cannot be 0 or empty string");
        require(find(state.lockedPayments, action.paymentID) != 0, "No locked payment with that paymentID exists");
        Payment memory lockedPayment = find(state.lockedPayments, action.paymentID);

        require(lockedPayment.timeout == 0 || lockedPayment.timeout <= block.number, "Timeout must be 0 or not have expired");
        if (lockedPayment.timeout <= block.number) {
            return remove(state.lockedPayments, action.paymentID);
        }
        bytes32 memory rawHash = keccak256(bytes32(action.data), bytes32(lockedPayment.paymentID)); // TODO any possibility of collision?
        require(lockedPayment.signer == rawHash.recover(action.signature), "Incorrect signer recovered from signature");

        //TODO if this unlocks, add to balances
        return remove(state.lockedPayments, action.paymentID);
    }

    function doReject(
        AppState memory state,
        Action memory action
    )
        internal
        pure
    {
        //TODO what do we want here?
    }

    function doFinalize(
        AppState memory state,
        Action memory action
    )
        internal
        pure
    {
        //TODO require that this can only be called by sender
        state.finalized == true;
        return state;
    }

    function insert(
        Payment[] memory lockedPayments,
        Payment memory newLockedPayment
    )
        internal
        pure
    {
        bool memory inserted = false;
        for (uint8 i = 0; i < lockedPayments.length(); i++) {
            if (lockedPayments[i] == 0 && !inserted) {
                lockedPayments[i] = newLockedPayment;
                inserted = true;
            }
            // Special case: all array slots are full
            if (i == lockedPayments.length()-1 && !inserted) {
                //TODO how do we want to handle this?
            }
        }
        return lockedPayments;
    }

    function remove(
        Payment[] memory lockedPayments,
        bytes32 memory paymentID
    )
        internal
        pure
    {
        bool memory removed = false;
        for (uint i = 0; i < lockedPayments.length(); i++) {
            if (lockedPayments[i].paymentID == paymentID && !removed) {
                lockedPayments[i] = 0;
                removed = true;
            }
            // No element with this paymentID -- shouldnt happen if we're validating correctly in actions
            if (i == lockedPayments.length()-1 && !removed) {
                //TODO how do we want to handle this?
            }
        }
        return lockedPayments;
    }

    function find(
        Payment[] memory lockedPayments,
        bytes32 memory paymentID
    )
        internal
        pure
    {
        bool memory found = false;
        Payment memory element = 0;
        for (uint i = 0; i < lockedPayments.length(); i++) {
            if (lockedPayments[i].paymentID == paymentID && !found) {
                element = lockedPayments[i];
                found = true;
            }
            // Multiple elements with this paymentID -- if this happens, it's real bad
            if (lockedPayments[i].paymentID = paymentID && found) {
                revert("Multiple elements with this paymentID, THIS SHOULD NEVER HAPPEN!!");
            }
        }
        return element;
    }
}