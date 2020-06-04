import {
  getTestEIP712Domain,
  getTestReceiptToSign,
  recoverAttestationSigner,
  signReceiptMessage,
} from "./attestations";

describe("Attestations", () => {
  test("sign receipt and create attestation", async () => {
    const privateKey = "0x8a62a0832558c6bea9e29d8dcc965d4c27528ef81f22a649ba0092946e2f04fa";

    const receipt = getTestReceiptToSign();
    const chainId = 1;
    const domain = getTestEIP712Domain(chainId);

    const signature = await signReceiptMessage(domain, receipt, privateKey);
    console.log("receipt", receipt);
    expect(signature).toEqual(
      "0x94f94cb0523051889b67adcf1e39358f69247722338563627d55b66f434402090c9e2cc9ada737d9b813c3bbea5628034ddfd25218cda41236aa0120f973037d1b",
    );
  });
  test("recover attestation signer", async () => {
    const chainId = 4447;
    const domain = getTestEIP712Domain(chainId);
    const receipt = getTestReceiptToSign();

    const signature =
      "0xf935516901d11fdfeb3ce0816f3238084a7de131825c7a55054876d43aabe1643b1116d5b0e80fc89f3ed97de4a2839c4401742e5ec2de50b1549253288cc0fe1c";
    const signer = await recoverAttestationSigner(domain, receipt, signature);
    expect(signer).toEqual("0x8682a38538F0A6D4208B2ce346dCA77d8075BB8f");
  });
});
