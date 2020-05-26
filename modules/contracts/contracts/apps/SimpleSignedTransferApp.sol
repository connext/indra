pragma solidity 0.6.7;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../adjudicator/interfaces/CounterfactualApp.sol";
import "../funding/libs/LibOutcome.sol";


/// @title Simple Signed Transfer App
/// @notice This contract allows users to claim a payment locked in
///         the application if the specified signed submits the correct
///         signature for the provided data
contract SimpleSignedTransferApp is CounterfactualApp {
    using SafeMath for uint256;

    struct AppState {
        LibOutcome.CoinTransfer[2] coinTransfers;
        address signer;
        address verifyingContract;
        bytes32 paymentId;
        bool finalized;
    }

    struct Action {
        bytes32 requestCID;
        bytes32 responseCID;
        bytes32 subgraphID;
        bytes signature;
    }

    // EIP-712 TYPE HASH CONSTANTS

    bytes32 private constant DOMAIN_TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
    );
    bytes32 private constant RECEIPT_TYPE_HASH = keccak256(
        "Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphID)"
    );

    // EIP-712 DOMAIN SEPARATOR CONSTANTS
 
    string private constant DOMAIN_NAME = "Graph Protocol";
    string private constant DOMAIN_VERSION = "0";
    bytes32 private constant DOMAIN_SALT = 0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2;

    // GET CHAIN ID

    function getChainID() public pure returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    // EIP-712 TYPE DATA METHODS

    function hashStruct(bytes32 typeHash, bytes memory values) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                typeHash,
                values
            )
        );
    }

    function hashTypedMessage(bytes32 domainSeparator, bytes32 message) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    domainSeparator,
                    message
                )
            );
    }

    // ATTESTATION ENCODING METHODS

    function encodeDomainSeparator(address verifyingContract) public view returns(bytes32) {
        return
            hashStruct(
                DOMAIN_TYPE_HASH,
                abi.encode(
                    DOMAIN_NAME,
                    DOMAIN_VERSION,
                    getChainID(),
                    verifyingContract,
                    DOMAIN_SALT
                )
            );
    }

    function encodeReceiptData(Action memory action) public view returns(bytes32) {
        return
            hashStruct(
                RECEIPT_TYPE_HASH,
                abi.encode(action.requestCID, action.responseCID, action.subgraphID)
            );
    }

    function recoverAttestationSigner(Action memory action, address verifyingContract) public view returns (address) {
        bytes32 messageHash = hashTypedMessage(
            encodeDomainSeparator(verifyingContract),
            encodeReceiptData(action)
        );

        return ECDSA.recover(messageHash, action.signature);
    }



    function applyAction(
        bytes calldata encodedState,
        bytes calldata encodedAction
    )
        override
        external
        view
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        Action memory action = abi.decode(encodedAction, (Action));

        require(!state.finalized, "Cannot take action on finalized state");
        
        require(state.signer == recoverAttestationSigner(action, state.verifyingContract), "Incorrect signer recovered from signature");

        state.coinTransfers[1].amount = state.coinTransfers[0].amount;
        state.coinTransfers[0].amount = 0;
        state.finalized = true;

        return abi.encode(state);
    }

    function computeOutcome(bytes calldata encodedState)
        override
        external
        view
        returns (bytes memory)
    {
        AppState memory state = abi.decode(encodedState, (AppState));

        return abi.encode(state.coinTransfers);
    }

    function getTurnTaker(
        bytes calldata /* encodedState */,
        address[] calldata participants
    )
        override
        external
        view
        returns (address)
    {
        return participants[1]; // receiver should always be indexed at [1]
    }

    function isStateTerminal(bytes calldata encodedState)
        override
        external
        view
        returns (bool)
    {
        AppState memory state = abi.decode(encodedState, (AppState));
        return state.finalized;
    }
}
