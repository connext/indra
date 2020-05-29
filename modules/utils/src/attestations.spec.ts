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
        "0xb5e828b4a8acdf0f616e309a4cb41557283e20f1e6f70185473dba430048e5bd300f7026b2c150a4ec5545434f5bf190039f807e72ce848779f4453e6a8bb4ff1b",
    });
  });
});
