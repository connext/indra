import { IChannelSigner, EthereumCommitment } from "@connext/types";
import { getRandomChannelSigner, recoverAddressFromChannelMessage } from "@connext/utils";
import { constants, utils } from "ethers";

import { expect } from "../testing/assertions";

import { assertIsValidSignature } from "./utils";

const { HashZero } = constants;
const { hashMessage } = utils;

describe("Signature Validator Helper", () => {
  let signer: IChannelSigner;
  let signature: string;
  let commitment: EthereumCommitment;
  let commitmentHash: string;

  beforeEach(async () => {
    signer = getRandomChannelSigner();

    commitment = {
      hashToSign: () => hashMessage("test"),
    } as EthereumCommitment;
    commitmentHash = commitment.hashToSign();
    signature = await signer.signMessage(commitmentHash);
  });

  it("validates signatures correctly", async () => {
    await expect(
      assertIsValidSignature(signer.address, commitmentHash, signature),
    ).to.eventually.eq(undefined);
  });

  it("throws if signature is undefined", async () => {
    await expect(
      assertIsValidSignature(signer.address, commitmentHash, undefined),
    ).to.eventually.be.rejectedWith("assertIsValidSignature received an undefined signature");
  });

  it("throws if commitment is undefined", async () => {
    await expect(
      assertIsValidSignature(signer.address, undefined, signature),
    ).to.eventually.be.rejectedWith("assertIsValidSignature received an undefined commitment");
  });

  it("throws if the signature is wrong", async () => {
    const rightHash = commitment.hashToSign();
    const wrongHash = HashZero.replace("00", "11"); // 0x11000...
    const signature = await signer.signMessage(wrongHash);
    const wrongSigner = await recoverAddressFromChannelMessage(rightHash, signature);
    await expect(
      assertIsValidSignature(signer.address, commitmentHash, signature),
    ).to.eventually.be.rejectedWith(
      `Validating a signature with expected signer ${signer.address} but recovered ${wrongSigner} for commitment hash ${rightHash}.`,
    );
  });
});
