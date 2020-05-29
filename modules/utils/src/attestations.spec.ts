import {
  signReceiptMessage,
  getTestReceiptToSign,
  getTestVerifyingContract,
  recoverAttestationSigner,
} from "./attestations";
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
        "0xb5e828b4a8acdf0f616e309a4cb41557283e20f1e6f70185473dba430048e5bd300f7026b2c150a4ec5545434f5bf190039f807e72ce848779f4453e6a8bb4ff1b",
    });
  });
  test("recover attestation signer", async () => {
    const chainId = 4447;
    const signature =
      "0xf935516901d11fdfeb3ce0816f3238084a7de131825c7a55054876d43aabe1643b1116d5b0e80fc89f3ed97de4a2839c4401742e5ec2de50b1549253288cc0fe1c";
    const signer = await recoverAttestationSigner(
      getTestReceiptToSign(),
      chainId,
      getTestVerifyingContract(),
      signature,
    );
    expect(signer).toEqual("0x1e17533c66A6693252fe1302a07210C500EF8e74");
  });
});
