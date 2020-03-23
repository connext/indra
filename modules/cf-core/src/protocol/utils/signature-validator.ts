import { recoverAddress, getLowerCaseAddress } from "@connext/crypto";

import { EthereumCommitment } from "../../types";

export async function assertIsValidSignature(
  expectedSigner: string,
  commitment?: EthereumCommitment,
  signature?: string,
): Promise<void> {
  if (typeof commitment === "undefined") {
    throw new Error("assertIsValidSignature received an undefined commitment");
  }

  if (typeof signature === "undefined") {
    throw new Error("assertIsValidSignature received an undefined signature");
  }

  const hash = commitment.hashToSign();

  // recoverAddress: 83 ms, hashToSign: 7 ms
  const signer = await recoverAddress(hash, signature);

  if (getLowerCaseAddress(expectedSigner) !== signer.toLowerCase()) {
    throw new Error(
      `Validating a signature with expected signer ${expectedSigner} but recovered ${signer} for commitment hash ${hash}.`,
    );
  }
}
