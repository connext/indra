import { HashZero } from "ethers/constants";
import { SigningKey } from "ethers/utils";
import { signDigest } from "@connext/crypto";

import { EthereumCommitment } from "../../../../src/types";
import { assertIsValidSignature } from "../../../../src/protocol/utils/signature-validator";
import { recoverAddressWithEthers } from "../../../../src/utils";
import { createRandom32ByteHexString } from "../../mocks";

describe("Signature Validator Helper", () => {
  let signer: SigningKey;
  let signature: string;
  let commitment: EthereumCommitment;

  beforeEach(async () => {
    signer = new SigningKey(createRandom32ByteHexString());

    commitment = {
      hashToSign: () => HashZero,
    } as EthereumCommitment;
    const commitmentHash = commitment.hashToSign();
    signature = await signDigest(signer.privateKey, commitmentHash);
  });

  it("validates signatures correctly", async () => {
    await expect(assertIsValidSignature(signer.address, commitment, signature)).resolves.toBe(
      undefined,
    );
  });

  it("throws if signature is undefined", async () => {
    await expect(assertIsValidSignature(signer.address, commitment, undefined)).rejects.toThrow(
      "assertIsValidSignature received an undefined signature",
    );
  });

  it("throws if commitment is undefined", async () => {
    await expect(assertIsValidSignature(signer.address, undefined, signature)).rejects.toThrow(
      "assertIsValidSignature received an undefined commitment",
    );
  });

  it("throws if the signature is wrong", async () => {
    const rightHash = commitment.hashToSign();
    const wrongHash = HashZero.replace("00", "11"); // 0x11000...
    const signature = await signDigest(signer.privateKey, wrongHash);
    const wrongSigner = await recoverAddressWithEthers(rightHash, signature);
    await expect(assertIsValidSignature(signer.address, commitment, signature)).rejects.toThrow(
      `Validating a signature with expected signer ${signer.address} but recovered ${wrongSigner} for commitment hash ${rightHash}.`,
    );
  });
});
