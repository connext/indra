import { signReceipt, getTestVerifyingContract, getTestReceiptToSign } from "./attestations";
import { Wallet } from "ethers";
import { joinSignature } from "ethers/utils";

describe("Attestations", () => {
  test("attestations are correct", async () => {
    const mnemonic = "coyote tattoo slush ball cluster culture bleak news when action cover effort";

    const receipt = getTestReceiptToSign();
    const chainId = 1;
    const verifyingContract = getTestVerifyingContract();

    const signer = Wallet.fromMnemonic(mnemonic);
    const signature = await signReceipt(receipt, chainId, verifyingContract, signer.privateKey);

    const attestation = {
      ...receipt,
      signature,
    };

    expect(attestation).toStrictEqual({
      requestCID: receipt.requestCID,
      responseCID: receipt.responseCID,
      subgraphID: receipt.subgraphID,
      signature: joinSignature({
        v: 28,
        r: "0x5eb1e2428518b5fac8904e3239b6bda39cd52ecd054b271b94ae6145976c4ef3",
        s: "0x38f0f5c725bef4c799d440a2b846d09ab268b23fd363964445643267d789cfd2",
      }),
    });
  });
});
