import { ConnextStore } from "@connext/store";
import { JsonRpcProvider, StoreTypes, NetworkContext } from "@connext/types";
import { Contract, Wallet } from "ethers";

import { setupContext, expect } from "./utils";

import { Watcher } from "../src";
import { ChannelSigner, getRandomAddress } from "@connext/utils";

describe("Watcher.init", () => {
  let provider: JsonRpcProvider;

  beforeEach(async () => {
    const context = await setupContext();
    provider = context["provider"];
  });

  it("should be able to instantiate with a private key", async () => {
    const guard = await Watcher.init({
      signer: Wallet.createRandom().privateKey,
      provider: provider.connection.url,
      store: new ConnextStore(StoreTypes.Memory),
      context: { ChallengeRegistry: getRandomAddress() } as any,
    });
    expect(guard).to.be.instanceOf(Watcher);
  });

  it("should be able to instantiate with a ChannelSigner", async () => {
    const guard = await Watcher.init({
      signer: new ChannelSigner(Wallet.createRandom().privateKey, provider.connection.url),
      provider: provider,
      store: new ConnextStore(StoreTypes.Memory),
      context: { ChallengeRegistry: getRandomAddress() } as any,
    });
    expect(guard).to.be.instanceOf(Watcher);
  });
});

describe.only("Watcher.initiate", () => {
  let challengeRegistry: Contract;
  let provider: JsonRpcProvider;
  let store: ConnextStore;
  let multisigAddress: string;
  let identityHash: string;

  let watcher: Watcher;

  beforeEach(async () => {
    const context = await setupContext();
    provider = context["provider"];
    challengeRegistry = context["challengeRegistry"];
    multisigAddress = context["multisigAddress"];
    identityHash = context["appInstance"].identityHash;
    const loadStore = context["loadStoreWithChannelAndApp"];

    // create + load store
    store = new ConnextStore(StoreTypes.Memory);
    console.log(`trying to load store...`);
    await loadStore(store);
    console.log(`loaded!`)

    watcher = await Watcher.init({
      context: { ChallengeRegistry: challengeRegistry.address } as NetworkContext,
      provider,
      store,
      signer: Wallet.createRandom().privateKey,
    });
  });

  it("should be able to initiate a dispute with a particular app instance", async () => {
    const channel = await store.getStateChannelByAppIdentityHash(identityHash);
    expect(channel).to.be.ok;
    const tx = await watcher.initiate(identityHash);
    expect(tx).to.be.ok;
  });
});
