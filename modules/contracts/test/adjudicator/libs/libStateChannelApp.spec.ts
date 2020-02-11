import * as waffle from "ethereum-waffle";
import { Wallet, Contract } from "ethers";
import { Web3Provider } from "ethers/providers";

import { randomBytes, hexlify, SigningKey, Signature } from "ethers/utils";
import { expect, sortSignaturesBySignerAddress, signaturesToBytes, deployRegistry } from "../utils";

const alice =
  // 0xaeF082d339D227646DB914f0cA9fF02c8544F30b
  new Wallet("0x3570f77380e22f8dc2274d8fd33e7830cc2d29cf76804e8c21f4f7a6cc571d27");

const bob =
  // 0xb37e49bFC97A948617bF3B63BC6942BB15285715
  new Wallet("0x4ccac8b1e81fb18a98bbaf29b9bfe307885561f71b76bd4680d7aec9d0ddfcfd");

describe("LibStateChannelApp.sol", () => {
  let provider: Web3Provider;
  let wallet: Wallet;

  let libStateChannelApp: Contract;

  const hash = hexlify(randomBytes(32));

  const sortedSigners = [alice.address, bob.address].sort();
  const sortedSigs = sortSignaturesBySignerAddress(hash, [
    new SigningKey(alice.privateKey).signDigest(hash),
    new SigningKey(bob.privateKey).signDigest(hash),
  ]).map((sig: Signature) => signaturesToBytes(sig));

  const verifySignatures = async (signers: string[] = sortedSigners, sigs: string[] = sortedSigs) => {
    return await libStateChannelApp.functions.verifySignatures(sigs, hash, signers);
  };

  before(async () => {
    provider = waffle.createMockProvider();
    wallet = (await waffle.getWallets(provider))[0];

    libStateChannelApp = await deployRegistry(wallet);
  });

  it("fails if the signatures array length !== number of signers", async () => {
    await expect(verifySignatures([sortedSigners[0]])).to.be.revertedWith(
      `Signers and signatures should be of equal length`,
    );
  });

  it("fails if the signers are not in alphanumeric order", async () => {
    const unsortedSigners = [sortedSigners[1], sortedSigners[0]];
    const unsortedSigs = [sortedSigs[1], sortedSigs[0]];
    await expect(verifySignatures(unsortedSigners, unsortedSigs)).to.be.revertedWith(
      `Signers not in alphanumeric order`,
    );
  });

  it("fails if the signatures are not valid", async () => {
    await expect(verifySignatures([...sortedSigners].reverse())).to.be.revertedWith(`Invalid signature`);
  });

  it("can call correctly verify signatures", async () => {
    const res = await verifySignatures();
    expect(res).to.be.true;
  });
});
