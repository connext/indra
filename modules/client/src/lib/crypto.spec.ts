import { Wallet } from "ethers";
import { computePublicKey } from "ethers/utils";

import { decryptWithPrivateKey, encryptWithPublicKey } from "./crypto";

describe("crypto", () => {
  test("we should be able to decrypt the thing that's encrypted", async () => {
    const prvKey = Wallet.createRandom().privateKey;
    const pubKey = computePublicKey(prvKey);
    const message = "Hello World!";
    const encrypted = await encryptWithPublicKey(pubKey, message);
    const decrypted = await decryptWithPrivateKey(prvKey, encrypted);
    console.log(`Decryped message: ${decrypted}`);
    expect(message).toEqual(decrypted);
  });
});
