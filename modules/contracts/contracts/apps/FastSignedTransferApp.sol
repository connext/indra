pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../adjudicator/interfaces/CounterfactualApp.sol";
import "../funding/libs/LibOutcome.sol";

/// @title Fast Signed Transfer App
/// @notice This contract allows the user to send transfers
///         using takeAction which are resolves with a sig
///         from a predefined signer


contract FastSignedTransferApp is CounterfactualApp {

    using SafeMath for uint256;
    using ECDSA for bytes32;

    enum ActionType {
        CREATE,
        UNLOCK,
        REJECT
    }

    struct Payment {
        string recipientXpub; // Not checked in app, but is part of the state for intermediaries to use
        uint256 amount;
        address signer;
        // This needs to be unique to each payment - the entropy is used to ensure that
        // intermediaries can't steal money by replaying state.
        bytes32 paymentId;
        bytes32 data;
        bytes signature;
    }

    struct AppState {
        Payment[] lockedPayments;
        LibOutcome.CoinTransfer[2] coinTransfers; // balances
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

    function computeOutcome(bytes calldata encodedState)
        external
        pure
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        return abi.encode(state.coinTransfers);
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
        for (uint i = 0; i < action.newLockedPayments.length; i++) {
            require(
                action.newLockedPayments[i].paymentId != bytes32(0), "paymentId cannot be empty bytes"
            );
            require(
                (find(state.lockedPayments, action.newLockedPayments[i].paymentId)).paymentId == bytes32(0), "Locked payment with this paymentId already exists."
            );
            require(action.newLockedPayments[i].amount <= state.coinTransfers[0].amount, "Insufficient balance for new locked payment");
            require(action.newLockedPayments[i].data == bytes32(0), "Data field must be empty bytes");

            // Reduce sender's balance by locked payment amount and then insert into state lockedPayments array
            state.coinTransfers[0].amount = state.coinTransfers[0].amount.sub(action.newLockedPayments[i].amount);
            state.lockedPayments = insert(state.lockedPayments, action.newLockedPayments[i]);
        }
        return state;
    }

    function doUnlock(
        AppState memory state,
        Action memory action
    )
        internal
        pure
        returns (AppState memory)
    {
        require(state.turnNum % 2 == 1, "Only receivers can unlock payments.");
        for (uint i = 0; i < action.newLockedPayments.length; i++) {
            require(
                action.newLockedPayments[i].paymentId != bytes32(0),
                "paymentId cannot be empty bytes"
            );
            require(
                (find(state.lockedPayments, action.newLockedPayments[i].paymentId)).paymentId != bytes32(0),
                "No locked payment with that paymentId exists"
            );

            Payment memory lockedPayment = find(state.lockedPayments, action.newLockedPayments[i].paymentId);
            // TODO any possibility of collision?
            bytes32 rawHash = keccak256(abi.encodePacked(action.newLockedPayments[i].data, lockedPayment.paymentId));
            require(lockedPayment.signer == rawHash.recover(action.newLockedPayments[i].signature), "Incorrect signer recovered from signature");

            // Add balances to transfers
            state.coinTransfers[1].amount = state.coinTransfers[1].amount.add(lockedPayment.amount);
            state.lockedPayments = remove(state.lockedPayments, action.newLockedPayments[i].paymentId);
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
                action.newLockedPayments[i].paymentId != bytes32(0),
                "paymentId cannot be 0"
            );
            state.lockedPayments = remove(state.lockedPayments, action.newLockedPayments[i].paymentId);
        }
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
        bytes32 paymentId
    )
        internal
        pure
        returns (Payment[] memory)
    {
        uint j = 0;
        Payment[] memory newLockedPayments = new Payment[](lockedPayments.length-1);
        for (uint i = 0; i < lockedPayments.length; i++) {
            // If the element should stay, write it to a new array
            if (lockedPayments[i].paymentId != paymentId) {
                newLockedPayments[j] = lockedPayments[i];
                j++;
            }
        }
        return newLockedPayments;
    }

    function find(
        Payment[] memory lockedPayments,
        bytes32 paymentId
    )
        internal
        pure
        returns (Payment memory)
    {
        Payment memory element;
        for (uint i = 0; i < lockedPayments.length; i++) {
            if (lockedPayments[i].paymentId == paymentId) {
                element = lockedPayments[i];
                break;
            }
        }
        return element;
    }
}