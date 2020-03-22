import { getAddress } from "ethers/utils";
import { recoverAddressWithEthers } from "@connext/types";

export async function assertIsValidSignature(
  expectedSigner: string,
  commitmentHash?: string,
  signature?: string,
): Promise<void> {
  if (typeof commitmentHash === "undefined") {
    throw new Error("assertIsValidSignature received an undefined commitment");
  }

  if (typeof signature === "undefined") {
    throw new Error("assertIsValidSignature received an undefined signature");
  }

  // recoverAddress: 83 ms, hashToSign: 7 ms
  const signer = await recoverAddressWithEthers(commitmentHash, signature);

  if (getAddress(expectedSigner).toLowerCase() !== signer.toLowerCase()) {
    throw new Error(
      `Validating a signature with expected signer ${expectedSigner} but recovered ${signer} for commitment hash ${commitmentHash}.`,
    );
  }
}
