/* global before */
import { Contract, Wallet } from "ethers";
import * as waffle from "ethereum-waffle";

import { provider, snapshot, setupContext, restore, expect } from "../utils";

import AppWithAction from "../../../build/AppWithAction.json";
import ChallengeRegistry from "../../../build/ChallengeRegistry.json";
import { BigNumberish } from "ethers/utils";

describe.skip("LibStateChannelApp", () => {

  let appRegistry: Contract;
  let appDefinition: Contract;

  let wallet: Wallet;

  let snapshotId: any;

  // helpers
  let hasPassed: (timeout: BigNumberish) => Promise<boolean>;

  before(async () => {
    wallet = (await provider.getWallets())[0];
    await wallet.getTransactionCount();

    appRegistry = await waffle.deployContract(wallet, ChallengeRegistry);
    appDefinition = await waffle.deployContract(wallet, AppWithAction);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
    const context = await setupContext(appRegistry, appDefinition);

    // helpers
    hasPassed = context["hasPassed"];
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("hasPassed", () => {
    it("should return true if timeout < curr block", async () => {
      const currBlock = await provider.getBlockNumber();
      expect(await hasPassed(currBlock - 1)).to.be.true;
    });

    it("should return true if timeout == curr block", async () => {
      const currBlock = await provider.getBlockNumber();
      expect(await hasPassed(currBlock)).to.be.true;
    });

    it("should return false if timeout > curr block", async () => {
      const currBlock = await provider.getBlockNumber();
      expect(await hasPassed(currBlock + 1)).to.be.false;
    });
  });

  describe("isDisputable", () => {});

  describe("isDisputable", () => {});

  describe("isCancellable", () => {});

  describe("verifySignatures", () => {});
});
