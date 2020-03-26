import { HashZero } from "ethers/constants";
import { SigningKey, hashMessage } from "ethers/utils";
import { signDigest } from "@connext/crypto";
import { recoverAddressWithEthers, createRandom32ByteHexString } from "@connext/types";

import { EthereumCommitment } from "../../../../src/types";
import { assertIsValidSignature } from "../../../../src/protocol/utils/signature-validator";

describe("Signature Validator Helper", () => {
  let signer: SigningKey;
  let signature: string;
  let commitment: EthereumCommitment;
  let commitmentHash: string;

  beforeEach(async () => {
    signer = new SigningKey(createRandom32ByteHexString());

    commitment = {
      hashToSign: () => hashMessage("test"),
    } as EthereumCommitment;
    commitmentHash = commitment.hashToSign();
    signature = await signDigest(signer.privateKey, commitmentHash);
  });

  it("validates signatures correctly", async () => {
    await expect(assertIsValidSignature(signer.address, commitmentHash, signature)).resolves.toBe(
      undefined,
    );
  });

  it("throws if signature is undefined", async () => {
    await expect(assertIsValidSignature(signer.address, commitmentHash, undefined)).rejects.toThrow(
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
    await expect(assertIsValidSignature(signer.address, commitmentHash, signature)).rejects.toThrow(
      `Validating a signature with expected signer ${signer.address} but recovered ${wrongSigner} for commitment hash ${rightHash}.`,
    );
  });
});
