import { getAddress, recoverAddress } from "ethers/utils";
import { isHexString, addHexPrefix } from "@connext/crypto";

import { EthereumCommitment } from "../../types";

function sanitizeHexString(hex: string): string {
  return isHexString(hex) ? addHexPrefix(hex) : hex;
}

export function assertIsValidSignature(
  expectedSigner: string,
  commitment?: EthereumCommitment,
  signature?: string,
) {
  if (commitment === undefined) {
    throw Error("assertIsValidSignature received an undefined commitment");
  }

  if (signature === undefined) {
    throw Error("assertIsValidSignature received an undefined signature");
  }

  const hash = commitment.hashToSign();

  // recoverAddress: 83 ms, hashToSign: 7 ms
  const signer = recoverAddress(sanitizeHexString(hash), sanitizeHexString(signature));

  if (getAddress(expectedSigner) !== signer) {
    throw Error(
      `Validating a signature with expected signer ${expectedSigner} but recovered ${signer} for commitment hash ${hash}.`,
    );
  }
}
