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
        bytes32 paymentID;
        uint256 timeout; // Block height. 0 is special case where there's no timeout.
        address recipient;
        // PaymentStatus status;
    }

    struct AppState {
        Payment[10] lockedPayments;
        LibOutcome.CoinTransfer[2] transfers; // balances
        bool finalized;
        uint256 turnNum;
    }

    struct Action {
        bytes32 paymentID;
        // sender-supplied
        Payment newLockedPayment;
        // receiver-supplied
        bytes32 signature;
        bytes32 data;
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
            revert("State is not finalized. Please finalize before uninstalling"); // TODO: Revert here? Or do something else?
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
        // TODO require that this can only be called by sender
        require(action.paymentID != "" && action.paymentID != 0, "PaymentID cannot be 0 or empty string");
        require(find(state.lockedPayments, action.paymentID) == 0, "Locked payment with this paymentID already exists.");
        require(action.paymentID == action.newLockedPayment.paymentID, "PaymentIDs in action and payment object should be the same.");
        // TODO require that the created payment is for less than the amount allocated to locked/completed payments so far
        // TODO reduce the "balance" by this locked payment
        return insert(state.lockedPayments, action.newLockedPayment);
    }

    function doUnlock(
        AppState memory state,
        Action memory action
    )
        internal
        pure
    {
        // TODO require that this can only be called by receiver
        require(action.paymentID != "" && action.paymentID != 0, "PaymentID cannot be 0 or empty string");
        require(find(state.lockedPayments, action.paymentID), "No locked payment with that paymentID exists");
        Payment memory lockedPayment = find(state.lockedPayments, action.paymentID);

        //TODO convention for block number vs block time?
        require(lockedPayment.timeout == 0 || lockedPayment.timeout >= block.number, "Timeout must be 0 or not have expired");
        bytes32 memory rawHash = keccak256(bytes32(action.data), bytes32(lockedPayment.paymentID));
        require(recoverSigner(rawHash, action.signature) == lockedPayment.signer, "Incorrect signer recovered from signature");

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

    function recoverSigner(
        bytes32 memory rawHash,
        bytes32 memory signature
    )
        internal
        pure
    {

    }
}