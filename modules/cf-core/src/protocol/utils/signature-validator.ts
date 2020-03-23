import { verifyChannelMessage, getLowerCaseAddress } from "@connext/crypto";

import { EthereumCommitment } from "../../types";

export async function assertIsValidSignature(
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

  // verifyChannelMessage: 83 ms, hashToSign: 7 ms
  const signer = await verifyChannelMessage(hash, signature);

  if (getLowerCaseAddress(expectedSigner) !== signer) {
    throw Error(
      `Validating a signature with expected signer ${expectedSigner} but recovered ${signer} for commitment hash ${hash}.`,
    );
  }
}
