pragma solidity ^0.6.4;
pragma experimental "ABIEncoderV2";

import "./IdentityApp.sol";


contract FinalizedApp is IdentityApp {
  function isStateTerminal(bytes calldata) external override view returns (bool) {
    return true;
  }
}
