pragma solidity 0.6.7;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";
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
        bytes32 paymentId;
        bool finalized;
    }

    struct Action {
        bytes32 requestCID;
        bytes32 responseCID;
        bytes32 subgraphID;
        bytes signature;
    }

    bytes32 private constant DOMAIN_TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
    );
    bytes32 private constant DOMAIN_NAME_HASH = keccak256("Graph Protocol");
    bytes32 private constant DOMAIN_VERSION_HASH = keccak256("0");
    bytes32 private constant DOMAIN_SALT = 0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2;
    bytes32 private constant RECEIPT_TYPE_HASH = keccak256(
        "Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphID)"
    );

    function getChainID() public pure returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function encodeHashReceipt(bytes memory receipt) public view returns (bytes32) {
       bytes32 memory domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPE_HASH,
                DOMAIN_NAME_HASH,
                DOMAIN_VERSION_HASH,
                _getChainID(),
                address(this),
                DOMAIN_SALT
            )
       );
       return
          keccak256(
              abi.encodePacked(
                  "\x19\x01", // EIP-191 encoding pad, EIP-712 version 1
                  domainSeparator,
                  keccak256(
                      abi.encode(RECEIPT_TYPE_HASH, receipt) // EIP 712-encoded message hash
                  )
              )
          );
    }

    function recoverAttestationSigner(Action memory action) public view returns (address) {
        // Obtain the hash of the fully-encoded message, per EIP-712 encoding
        bytes memory receipt = abi.encode(
            action.requestCID,
            action.responseCID,
            action.subgraphID
        );
        bytes32 messageHash = encodeHashReceipt(receipt);

        // Obtain the signer of the fully-encoded EIP-712 message hash
        // NOTE: The signer of the attestation is the indexer that served the request
        return ECDSA.recover(digest, action.signature);
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
        
        address memory attestationSigner = recoverAttestationSigner(action)
        require(state.signer == attestationSigner, "Incorrect signer recovered from signature");

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
