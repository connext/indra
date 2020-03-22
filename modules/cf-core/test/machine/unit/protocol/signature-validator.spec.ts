import { HashZero } from "ethers/constants";
import { hexlify, randomBytes, recoverAddress, SigningKey } from "ethers/utils";
import { signDigest } from "@connext/crypto";

import { EthereumCommitment } from "../../../../src/types";
import { assertIsValidSignature } from "../../../../src/protocol/utils/signature-validator";

describe("Signature Validator Helper", () => {
  let signer: SigningKey;
  let signature: string;
  let commitment: EthereumCommitment;

  beforeEach(async () => {
    signer = new SigningKey(hexlify(randomBytes(32)));

    commitment = {
      hashToSign: () => HashZero,
    } as EthereumCommitment;
    const commitmentHash = commitment.hashToSign();
    signature = await signDigest(signer.privateKey, commitmentHash);
  });

  it("validates signatures correctly", () => {
    expect(
      async () => await assertIsValidSignature(signer.address, commitment, signature),
    ).not.toThrow();
  });

  it("throws if signature is undefined", () => {
    expect(async () => await assertIsValidSignature(signer.address, commitment, undefined)).toThrow(
      "assertIsValidSignature received an undefined signature",
    );
  });

  it("throws if commitment is undefined", () => {
    expect(async () => await assertIsValidSignature(signer.address, undefined, signature)).toThrow(
      "assertIsValidSignature received an undefined commitment",
    );
  });

  it("throws if the signature is wrong", async () => {
    const rightHash = commitment.hashToSign();
    const wrongHash = HashZero.replace("00", "11"); // 0x11000...
    const signature = await signDigest(signer.privateKey, wrongHash);
    const wrongSigner = recoverAddress(rightHash, signature);
    expect(async () => await assertIsValidSignature(signer.address, commitment, signature)).toThrow(
      `Validating a signature with expected signer ${signer.address} but recovered ${wrongSigner} for commitment hash ${rightHash}`,
    );
  });
});
