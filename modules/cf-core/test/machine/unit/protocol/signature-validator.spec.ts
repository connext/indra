import { HashZero } from "ethers/constants";
import { SigningKey } from "ethers/utils";
import { signDigest, recoverAddress } from "@connext/crypto";

import { EthereumCommitment } from "../../../../src/types";
import { assertIsValidSignature } from "../../../../src/protocol/utils/signature-validator";
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
    const wrongSigner = await recoverAddress(rightHash, signature);
    expect(async () => await assertIsValidSignature(signer.address, commitment, signature)).toThrow(
      `Validating a signature with expected signer ${signer.address} but recovered ${wrongSigner} for commitment hash ${rightHash}`,
    );
  });
});
