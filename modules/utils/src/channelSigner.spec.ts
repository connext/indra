import * as eccryptoJS from "eccrypto-js";
import * as EthCrypto from "eth-crypto";
import * as ethers from "ethers";

import { ChannelSigner } from "./channelSigner";
import { INDRA_PUB_ID_PREFIX, recoverAddressFromChannelMessage } from "./crypto";
import { getPublicIdentifierFromPublicKey } from "./identifiers";

const privateKey = ethers.Wallet.createRandom().privateKey;
const publicKey = eccryptoJS.removeHexPrefix(ethers.utils.computePublicKey(privateKey));

const shortMessage = "123456789012345";
const longMessage = "1234567890123456";

const testMessage = "test message to sign";

const CF_PATH = "m/44'/60'/0'/25446";

// Mnemonic was pulled from the testnet daicard that received a test async transfer
const wallet = ethers.Wallet.fromMnemonic(
  "rely effort talent genuine pumpkin wire caught coil type alien offer obtain",
  `${CF_PATH}/0`,
);

const example = {
  address: wallet.address,
  encryptedMessage:
    "b304bbe1bc97a4f1101f3381b93a837f022b6ef864c41e7b8837779b59be67ef355cf2c918961251ec118da2c0abde3b0e803d817b2a3a318f60609023301748350008307ae20ccb1473eac05aced53180511e97cc4cec5809cb4f2ba43517d7951a71bd56b85ac161b8ccdc98dbeabfa99d555216cda31247c21d4a3caa7c46d37fa229f02f15ba254f8d6f5b15ed5310c35dd9ddd54cd23b99a7e332ed501605",
  message: "0xd10d622728d22635333ea792730a0feaede8b61902050a3f8604bb85d7013864",
  privateKey: wallet.privateKey,
  publicKey: ethers.utils.computePublicKey(wallet.privateKey),
  // TODO: verify this example by hand & hard code it instead of using the fn we're trying to test
  publicIdentifier: getPublicIdentifierFromPublicKey(
    ethers.utils.computePublicKey(wallet.privateKey),
  ), 
};

// Divide test suite into one section for each of our exports

describe("ChannelSigner", () => {
  it("should generate valid publicIdentifier", async () => {
    expect(
      new ChannelSigner(example.privateKey).publicIdentifier.startsWith(INDRA_PUB_ID_PREFIX),
    ).toBeTruthy;
  });

  it("should generate valid public key", async () => {});

  it("should generate valid address", async () => {});

  it("should be able to decrypt stuff it encrypts", async () => {
    const signer = new ChannelSigner(privateKey);
    const encrypted = await signer.encrypt(shortMessage, publicKey);
    const decrypted = await signer.decrypt(encrypted);
    expect(shortMessage).toEqual(decrypted);
  });

  it("should decrypt messages longer than 15 chars", async () => {
    const signer = new ChannelSigner(privateKey);
    const encrypted = await signer.encrypt(longMessage, publicKey);
    const decrypted = await signer.decrypt(encrypted);
    expect(longMessage).toEqual(decrypted);
  });

  it("should have encrypt/decrypt that are compatible with eth-crypto", async () => {
    const signer = new ChannelSigner(privateKey);
    const myEncrypted = await signer.encrypt(shortMessage, publicKey);
    const ethEncrypted = EthCrypto.cipher.stringify(
      await EthCrypto.encryptWithPublicKey(publicKey, shortMessage),
    );
    const myDecrypted = await signer.decrypt(ethEncrypted);
    const ethDecrypted = await EthCrypto.decryptWithPrivateKey(
      privateKey,
      EthCrypto.cipher.parse(myEncrypted),
    );
    expect(myDecrypted).toEqual(ethDecrypted);
    expect(myDecrypted).toEqual(shortMessage);
  });

  it("should have encrypt/decrypt that are compatible with browser crypto", async () => {
    const signer = new ChannelSigner(example.privateKey);
    const decrypted = await signer.decrypt(example.encryptedMessage);
    expect(decrypted).toEqual(example.message);
  });

  it("should sign Channel messages", async () => {
    const sig = await (new ChannelSigner(wallet.privateKey).signMessage(testMessage));
    expect(recoverAddressFromChannelMessage(testMessage, sig)).toBeTruthy();
  });
});
