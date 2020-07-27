// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.4;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../adjudicator/interfaces/CounterfactualApp.sol";
import "../funding/libs/LibOutcome.sol";

/// @title Graph Multi Transfer App
/// @notice This contract allows users to claim many payment locked in
///         the application if the specified signer submits the correct
///         signature for the provided data over many updates.
contract GraphMultiTransferApp is CounterfactualApp {

  using SafeMath for uint256;

  struct LockedPayment {
      bytes32 requestCID;
      uint256 price;
  }

  struct AppState {
    LibOutcome.CoinTransfer[2] coinTransfers;
    // Signature verification
    address signerAddress;
    uint256 chainId;
    address verifyingContract;
    bytes32 subgraphDeploymentID;
    // Payment state
    LockedPayment lockedPayment;
    // App defaults
    uint256 turnNum;
    bool finalized;
  }

  enum ActionType {
      CREATE,
      UNLOCK,
      FINALIZE
  }

  struct Action {
    ActionType actionType;
    // Nonzero when creating
    bytes32 requestCID;
    uint256 price;
    // Nonzero when unlocking
    bytes32 responseCID;
    bytes signature;
  }

  // EIP-712 TYPE HASH CONSTANTS

  bytes32 private constant DOMAIN_TYPE_HASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
  );
  bytes32 private constant RECEIPT_TYPE_HASH = keccak256(
    "Receipt(bytes32 requestCID,bytes32 responseCID,bytes32 subgraphDeploymentID)"
  );

  // EIP-712 DOMAIN SEPARATOR CONSTANTS

  bytes32 private constant DOMAIN_NAME_HASH = keccak256("Graph Protocol");
  bytes32 private constant DOMAIN_VERSION_HASH = keccak256("0");
  bytes32
    private constant DOMAIN_SALT = 0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2;

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
                state.lockedPayment.requestCID,
                action.responseCID,
                state.subgraphDeploymentID
              )
            )
          )
        ),
        action.signature
      );
  }

  function applyAction(bytes calldata encodedState, bytes calldata encodedAction)
    external
    override
    view
    returns (bytes memory)
  {
    AppState memory state = abi.decode(encodedState, (AppState));
    Action memory action = abi.decode(encodedAction, (Action));

    require(!state.finalized, "Cannot take action on finalized state");

    if (action.actionType == ActionType.CREATE) {
        // can only be called by sender
        require(state.turnNum % 2 == 0, "Transfers can only be created by the app initiator");
        require(state.coinTransfers[0].amount >= action.price, "Cannot create transfer for more value than in balance");

        state.lockedPayment.requestCID = action.requestCID;
        state.lockedPayment.price = action.price;
    } else if (action.actionType == ActionType.UNLOCK) {
        // can only be called by receiver
        require(state.turnNum % 2 == 1, "Transfers can only be unlocked by the app responder");

        // can cancel the payment with HashZero responseCID
        if (action.responseCID != bytes32(0)) {
            // this means we're unlocking
            require(
                state.signerAddress == recoverAttestationSigner(action, state),
                "Incorrect signer recovered from signature"
            );
            // handle payment
            state.coinTransfers[1].amount = state.coinTransfers[1].amount.add(state.lockedPayment.price);
            state.coinTransfers[0].amount = state.coinTransfers[0].amount.sub(state.lockedPayment.price);
        }

        // now clear the payment from state for completeness
        state.lockedPayment.requestCID = bytes32(0);
        state.lockedPayment.price = uint256(0);

    } else { // actionType == FINALIZE
        state.finalized = true;

        // clear the payment from state for completeness
        state.lockedPayment.requestCID = bytes32(0);
        state.lockedPayment.price = uint256(0);
    }

    state.turnNum += 1;
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
    bytes calldata encodedState,
    address[] calldata participants
  ) external override view returns (address) 
  {
    AppState memory state = abi.decode(encodedState, (AppState));
    return participants[state.turnNum % 2]; //receiver odd
  }

  function isStateTerminal(bytes calldata encodedState) external override view returns (bool) {
    AppState memory state = abi.decode(encodedState, (AppState));
    return state.finalized;
  }
}
