pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "../adjudicator/interfaces/CounterfactualApp.sol";
import "../funding/libs/LibOutcome.sol";


/// @title Simple Signature Transfer App
/// @notice This contract allows users to claim a payment locked in
///         the application if they provide the correct signature

contract SimpleSignatureTransferApp is CounterfactualApp {

  using SafeMath for uint256;

  /**
  * Assume the app is funded with the money already owed to receiver,
  * as in the SimpleTwoPartySwapApp.
  *
  * This app can also not be used to send _multiple_ linked payments,
  * only one can be redeemed with the preimage.
  *
  */

  struct AppState {
    LibOutcome.CoinTransfer[2] coinTransfers;
    // need these for computing outcome
    uint256 amount;
    address assetId;
    bytes32 paymentId;
    address signer;
    bytes32 data;
    bytes signature;
  }

  struct Action {
    bytes32 data;
    bytes signature;
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

    state.signature = action.signature;
    state.data = action.data;

    return abi.encode(state);
  }

  function computeOutcome(bytes calldata encodedState)
    external
    pure
    returns (bytes memory)
  {
    AppState memory state = abi.decode(encodedState, (AppState));

    bytes32 hash = keccak256(abi.encodePacked(
      state.amount,
      state.assetId,
      state.paymentId,
      state.data
    ));

    // get an Ethereum Signed Message, created from a `hash`
    hash = ECDSA.toEthSignedMessageHash(hash);

    // check that the message was signed by contract owner
    address signer = ECDSA.recover(hash, state.signature);

    LibOutcome.CoinTransfer[2] memory transfers;
    if (signer == state.signer) {
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
          /* should always be full value of linked payment */
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
