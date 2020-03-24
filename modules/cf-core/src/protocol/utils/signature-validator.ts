import { getAddress } from "ethers/utils";
import { recoverAddress } from "@connext/crypto";

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

  const commitmentEncoded = commitment.encode();

  // recoverAddress: 83 ms, encode: 7 ms
  const signer = await recoverAddress(commitmentEncoded, signature);

  if (getAddress(expectedSigner).toLowerCase() !== signer.toLowerCase()) {
    throw new Error(
      `Validating a signature with expected signer ${expectedSigner} but recovered ${signer} for encoded commitment ${commitmentEncoded}.`,
    );
  }
}
