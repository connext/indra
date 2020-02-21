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
        address assetId; // TODO: Do we need this?
        address signer;
        // This needs to be unique to each payment - the entropy is used to ensure that
        // intermediaries can't steal money by replaying state.
        bytes32 paymentID;
        uint256 timeout; // Block height. 0 is special case where there's no timeout.
        bytes recipientXpub; // Not checked in app, but is part of the state for intermediaries to use
        bytes32 data;
        bytes signature;
    }

    struct AppState {
        Payment[] lockedPayments; // What happens with many locked payments in a dispute?
        LibOutcome.CoinTransfer[2] transfers; // balances
        bool finalized;
        uint256 turnNum;
    }

    struct Action {
        Payment[] newLockedPayments;
        ActionType actionType;
    }

    function getTurnTaker(
        bytes calldata encodedState,
        address[2] calldata participants
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

        require(!state.finalized, "Cannot take actions in a finalized channel, please reinstall.");
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
        returns (AppState memory)
    {
        require(state.turnNum % 2 == 0, "Only senders can create locked payments.");
        for (uint8 i = 0; i < action.newLockedPayments.length; i++) { // TODO uint8?
            require(
                action.newLockedPayments[i].paymentID != "" && action.newLockedPayments[i].paymentID != 0, "PaymentID cannot be 0 or empty string"
            );
            require(
                (find(state.lockedPayments, action.newLockedPayments[i].paymentID)).paymentID == bytes32(0), "Locked payment with this paymentID already exists."
            );
            require(action.newLockedPayments[i].amount <= state.transfers[0].amount, "Insufficient balance for new locked payment");
            require(action.newLockedPayments[i].data == 0 || action.newLockedPayments[i].data == "", "Data field must be empty");
            require(action.newLockedPayments[i].signature.length == 0, "Signature field must be empty");

            // Reduce sender's balance by locked payment amount and then insert into state lockedPayments array
            state.transfers[0].amount = state.transfers[0].amount.sub(action.newLockedPayments[i].amount);
            state.lockedPayments = insert(state.lockedPayments, action.newLockedPayments[i]);
        }
        return state;
    }

    // TODO Can we safely batch unlock payments? Sender has incentive to choose the least unlocked one.
    function doUnlock(
        AppState memory state,
        Action memory action
    )
        internal
        pure
        returns (AppState memory)
    {
        require(state.turnNum % 2 == 1, "Only receivers can unlock payments.");
        for (uint8 i = 0; i < action.newLockedPayments.length; i++) {
            require(
                action.newLockedPayments[i].paymentID != bytes32(0),
                "PaymentID cannot be 0"
            );
            require(
                (find(state.lockedPayments, action.newLockedPayments[i].paymentID)).paymentID != bytes32(0),
                "No locked payment with that paymentID exists"
            );

            Payment memory lockedPayment = find(state.lockedPayments, action.newLockedPayments[i].paymentID);
            // If timeout exists and has expired, remove the locked payment without applying balances
            // TODO timeouts may not work w/ single-signed updates because node can just wait to countersign
            // TODO: need this to be lockedPayment.timeout <= block.number but that makes visibiity "view" which breaks
            if (lockedPayment.timeout <= 0 && lockedPayment.timeout != 0) {
                state.lockedPayments = remove(state.lockedPayments, action.newLockedPayments[i].paymentID);
            } else {
                bytes32 rawHash = keccak256(abi.encodePacked(action.newLockedPayments[i].data, lockedPayment.paymentID)); // TODO any possibility of collision?
                require(lockedPayment.signer == rawHash.recover(action.newLockedPayments[i].signature), "Incorrect signer recovered from signature");

                // Add balances to transfers
                state.transfers[1].amount = state.transfers[1].amount.add(lockedPayment.amount);
                state.lockedPayments = remove(state.lockedPayments, action.newLockedPayments[i].paymentID);
            }
        }
        return state;
    }

    function doReject(
        AppState memory state,
        Action memory action
    )
        internal
        pure
        returns (AppState memory)
    {
        require(state.turnNum % 2 == 1, "Only receivers can reject payments.");
        for (uint8 i = 0; i < action.newLockedPayments.length; i++) {
            require(
                action.newLockedPayments[i].paymentID != bytes32(0),
                "PaymentID cannot be 0"
            );
            state.lockedPayments = remove(state.lockedPayments, action.newLockedPayments[i].paymentID);
        }
        return state;
    }

    function doFinalize(
        AppState memory state,
        Action memory action
    )
        internal
        pure
        returns (AppState memory)
    {
        require(state.turnNum % 2 == 0, "Only senders can create finalize state.");
        state.finalized == true;
        return state;
    }

    function insert(
        Payment[] memory lockedPayments,
        Payment memory newLockedPayment
    )
        internal
        pure
        returns (Payment[] memory)
    {
        // Can't dynamically size arrays in-memory in solidity. Must copy to new array.
        Payment[] memory newLockedPayments = new Payment[](lockedPayments.length+1); // TODO is this the right pattern?
        for (uint i = 0; i <= lockedPayments.length; i++) {
            if (i == lockedPayments.length) {
                newLockedPayments[i] = newLockedPayment;
            } else {
                newLockedPayments[i] = lockedPayments[i];
            }
        }
        return newLockedPayments;
    }

    function remove(
        Payment[] memory lockedPayments,
        bytes32 paymentID
    )
        internal
        pure
        returns (Payment[] memory)
    {
        uint j = 0;
        Payment[] memory newLockedPayments = new Payment[](lockedPayments.length-1);
        for (uint i = 0; i < lockedPayments.length; i++) { // TODO uint size?
            // If the element should stay, write it to a new array
            if (lockedPayments[i].paymentID != paymentID) {
                newLockedPayments[j] = lockedPayments[i];
                j++;
            }
        }
        return newLockedPayments;
    }

    function find(
        Payment[] memory lockedPayments,
        bytes32 paymentID
    )
        internal
        pure
        returns (Payment memory)
    {
        Payment memory element;
        for (uint i = 0; i < lockedPayments.length; i++) {
            if (lockedPayments[i].paymentID == paymentID) {
                element = lockedPayments[i];
                break;
            }
        }
        return element;
    }
}