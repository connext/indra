import { getAddress, recoverAddress, Signature } from "ethers/utils";

import { EthereumCommitment } from "../../types";

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
  const signer = recoverAddress(hash, signature);

  if (getAddress(expectedSigner) !== signer) {
    throw Error(
      `Validating a signature with expected signer ${expectedSigner} but recovered ${signer} for commitment hash ${hash}.`,
    );
  }
}
