// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.4;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../adjudicator/interfaces/CounterfactualApp.sol";
import "../funding/libs/LibOutcome.sol";

/// @title Simple Batched Transfer App
/// @notice This contract allows a receiver to claim a batch of payments
///         upon providing a correctly signed balance update. Providing
///         the signature happens entirely out-of-band.


contract GraphBatchedTransferApp is CounterfactualApp {
    using SafeMath for uint256;

    struct AppState {
        LibOutcome.CoinTransfer[2] coinTransfers;
        address attestationSigner;
        address consumerSigner;
        uint256 chainId;
        address verifyingContract;
        bytes32 subgraphDeploymentID;
        uint256 swapRate; // MUST be in units of E18
        bytes32 paymentId;
        bool finalized;
    }

    struct Action {
        uint256 totalPaid;
        bytes32 requestCID;
        bytes32 responseCID;
        bytes consumerSignature;
        bytes attestationSignature;
    }

    // EIP-712 TYPE HASH CONSTANTS

    bytes32 private constant DOMAIN_TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
    );
    bytes32 private constant RECEIPT_TYPE_HASH = keccak256(
        "Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphDeploymentID)"
    );
    bytes32 private constant CONSUMER_TYPE_HASH = keccak256(
        "ConsumerBatchPayment(bytes32 paymentId,bytes32 requestCID,uint256 totalPaid)"
    );

    uint256 constant SWAP_CONVERSION = 10**18;

    // EIP-712 DOMAIN SEPARATOR CONSTANTS

    bytes32 private constant DOMAIN_NAME_HASH = keccak256("Graph Protocol");
    bytes32 private constant DOMAIN_VERSION_HASH = keccak256("0");
    bytes32 private constant DOMAIN_SALT = 0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2;

    function applyAction(bytes calldata encodedState, bytes calldata encodedAction)
        external
        override
        view
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        Action memory action = abi.decode(encodedAction, (Action));

        require(!state.finalized, "Cannot take action on finalized state");

        // Handle payment
        require(
            state.attestationSigner == recoverAttestationSigner(action, state),
            "Incorrect signer recovered from attestation signature"
        );

        require(
            state.consumerSigner == recoverConsumerSigner(action, state),
            "Incorrect signer recovered from consumer signature"
        );

        // to return a clean error
        require(
            action.totalPaid.mul(state.swapRate).div(SWAP_CONVERSION) <= state.coinTransfers[0].amount,
            "Cannot pay more funds than in balance"
        );

        state.coinTransfers[1].amount = state.coinTransfers[1].amount.add(action.totalPaid.mul(state.swapRate).div(SWAP_CONVERSION));
        state.coinTransfers[0].amount = state.coinTransfers[0].amount.sub(action.totalPaid.mul(state.swapRate).div(SWAP_CONVERSION));
        state.finalized = true;

        return abi.encode(state);
    }

    function computeOutcome(bytes calldata encodedState)
        external
        override
        view
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));

        return abi.encode(state.coinTransfers);
    }

    function getTurnTaker(
        bytes calldata, /* encodedState */
        address[] calldata participants
    ) external override view returns (address)
    {
        return participants[1]; // receiver should always be indexed at [1]
    }

    function isStateTerminal(bytes calldata encodedState) external override view returns (bool) {
        AppState memory state = abi.decode(encodedState, (AppState));
        return state.finalized;
    }

    function recoverAttestationSigner(Action memory action, AppState memory state)
        public
        pure
        returns (address)
    {
        return
            ECDSA.recover(
                keccak256(
                    abi.encodePacked(
                        "\x19\x01",
                        keccak256(
                            abi.encode(
                                DOMAIN_TYPE_HASH,
                                DOMAIN_NAME_HASH,
                                DOMAIN_VERSION_HASH,
                                state.chainId,
                                state.verifyingContract,
                                DOMAIN_SALT
                            )
                        ),
                        keccak256(
                            abi.encode(
                                RECEIPT_TYPE_HASH,
                                action.requestCID,
                                action.responseCID,
                                state.subgraphDeploymentID
                            )
                        )
                    )
                ),
                action.attestationSignature
            );
    }

    function recoverConsumerSigner(Action memory action, AppState memory state)
        public
        pure
        returns (address)
    {
        return
            ECDSA.recover(
                keccak256(
                    abi.encodePacked(
                        "\x19\x01",
                        keccak256(
                            abi.encode(
                                DOMAIN_TYPE_HASH,
                                DOMAIN_NAME_HASH,
                                DOMAIN_VERSION_HASH,
                                state.chainId,
                                state.verifyingContract,
                                DOMAIN_SALT
                            )
                        ),
                        keccak256(
                            abi.encode(
                                CONSUMER_TYPE_HASH,
                                state.paymentId,
                                action.requestCID,
                                action.totalPaid
                            )
                        )
                    )
                ),
                action.consumerSignature
            );
    }
}
