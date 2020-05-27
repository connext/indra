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
        "0xd970042dba310ed8f2e91e626dfb8568249af29cfe8aef89519cd0d3eda48f380b4eccca31636a2010e12b711fcdb2824c2bbf7c034dbb5369d5a3250c3e9acf1c",
    });
  });
});
