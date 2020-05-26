import { signReceiptMessage, getTestReceiptToSign, getTestVerifyingContract } from "./attestations";
import { Wallet } from "ethers";

describe("Attestations", () => {
  test("attestations are correct", async () => {
    const mnemonic = "coyote tattoo slush ball cluster culture bleak news when action cover effort";

    const receipt = getTestReceiptToSign();
    const chainId = 1;
    const verifyingContract = getTestVerifyingContract();

    const signer = Wallet.fromMnemonic(mnemonic);
    const signature = await signReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      signer.privateKey,
    );

    const attestation = {
      ...receipt,
      signature,
    };

    expect(attestation).toStrictEqual({
      requestCID: receipt.requestCID,
      responseCID: receipt.responseCID,
      subgraphID: receipt.subgraphID,
      signature:
        "0xeeed4eda0dbe4adcd28fb2d810b4255ffe9aaf7ceb23a42026e885fad89ae1db2ec2a74e59151a2d91f986e9b1a45c9d6c5afa82f6eec0ea9e8f8fc486715bb61b",
    });
  });
});
