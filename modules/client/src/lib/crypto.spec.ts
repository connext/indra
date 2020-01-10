import * as EthCrypto from "eth-crypto";
import { Wallet } from "ethers";
import { computePublicKey } from "ethers/utils";

import { decryptWithPrivateKey, encryptWithPublicKey } from "./crypto";

describe("crypto", () => {
  test("we should be able to decrypt newly encrypted things", async () => {
    const prvKey = Wallet.createRandom().privateKey;
    const pubKey = computePublicKey(prvKey);
    const message = "Hello World!";
    const encrypted = await encryptWithPublicKey(pubKey, message);
    const decrypted = await decryptWithPrivateKey(prvKey, encrypted);
    expect(message).toEqual(decrypted);
  });

  test("we should be able to decrypt messages that eth-crypto encrypted", async () => {
    const prvKey = Wallet.createRandom().privateKey;
    const pubKey = computePublicKey(prvKey);
    const message = "Hello World!";
    const encrypted = await EthCrypto.encryptWithPublicKey(pubKey.replace(/^0x/, ""), message);
    const encryptedMessage = EthCrypto.cipher.stringify(encrypted);
    const decrypted = await decryptWithPrivateKey(prvKey, encryptedMessage);
    expect(message).toEqual(decrypted);
  });

  test("eth-crypto should be able to decrypt messages that we encrypted", async () => {
    const prvKey = Wallet.createRandom().privateKey;
    const pubKey = computePublicKey(prvKey);
    const message = "Hello World!";
    const encrypted = await encryptWithPublicKey(pubKey, message);
    const decrypted = await EthCrypto.decryptWithPrivateKey(
      prvKey,
      EthCrypto.cipher.parse(encrypted),
    );
    console.log(`Decryped message: ${decrypted}`);
    expect(message).toEqual(decrypted);
  });

  test("we should be able to decrypt messages that previous versions encrypted", async () => {
    const mnemonic = "trophy chimney shove high merry type ready weasel trouble join hobby quick";
    const message = "0x7c728ba4ad2f5d2184ab5dd36b232764b1e3f9e29a311a5ef494373f5450df12";
    const encryptedMessage =
      "0f" +
      "c09f11f955bd9b4aa4122758d04c3003e2696d406176a9d56f757b3b978b7997" +
      "0106d265b80f0a586439430c91a5349ab1a1520d08c9181f9304e169cc6350f1" +
      "6fd440a3b548577aee91312056f9dccefe028b6bd1af2f2c65b561d6b9a6901f" +
      "5fac024238df89781e607e2ae612e6cfd20b3c95f5c0097af1d103c25520dca9" +
      "7c3756c82ba8629e14c28b15cba208451ae577c2540c0bcd1afbf94db23dd25a";
    const prvKey = Wallet.fromMnemonic(mnemonic).privateKey;
    const pubKey = computePublicKey(prvKey);
    const encrypted = await encryptWithPublicKey(pubKey, message);
    const decrypted = await decryptWithPrivateKey(prvKey, encrypted);
    console.log(`Encrypted message: ${decrypted}`);
    console.log(`Decryped message: ${decrypted}`);
    expect(encryptedMessage).toEqual(encrypted);
    expect(message).toEqual(decrypted);
  });
});
