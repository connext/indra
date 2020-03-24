pragma solidity 0.5.11;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

library LibChannelSigning {
  function hashChannelMessage(bytes memory message) internal pure returns (bytes32) {
      // 32 is the length in bytes of hash,
      // enforced by the type signature above
      return keccak256(abi.encodePacked("\x19Channel Signed Message:\n", message.length, message));
  }

  function verifyChannelMessage(bytes memory message, bytes memory signature) {
    return recover(hashChannelMessage(message), signature)
  }
} 