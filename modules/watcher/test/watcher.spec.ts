import { ConnextStore } from "@connext/store";
import {
  JsonRpcProvider,
  StoreTypes,
  BigNumber,
  WatcherEvents,
  StateProgressedEventData,
} from "@connext/types";
import { Wallet } from "ethers";

import {
  setupContext,
  expect,
  NetworkContextForTestSuite,
  MiniFreeBalance,
  AppWithCounterClass,
  verifyOnchainBalancesPostChallenge,
  verifyStateProgressedEvent,
} from "./utils";

import { Watcher } from "../src";
import { ChannelSigner, getRandomAddress, ColorfulLogger, toBN } from "@connext/utils";
import { initiateDispute } from "./utils/initiateDispute";
import { One } from "ethers/constants";
import { cancelDispute } from "./utils/cancelDispute";

describe("Watcher.init", () => {
  let provider: JsonRpcProvider;

  beforeEach(async () => {
    const context = await setupContext();
    provider = context["provider"];
  });

  it("should be able to instantiate with a private key", async () => {
    const watcher = await Watcher.init({
      signer: Wallet.createRandom().privateKey,
      provider: provider.connection.url,
      store: new ConnextStore(StoreTypes.Memory),
      context: { ChallengeRegistry: getRandomAddress() } as any,
    });
    expect(watcher).to.be.instanceOf(Watcher);
  });

  it("should be able to instantiate with a ChannelSigner", async () => {
    const watcher = await Watcher.init({
      signer: new ChannelSigner(Wallet.createRandom().privateKey, provider.connection.url),
      provider: provider,
      store: new ConnextStore(StoreTypes.Memory),
      context: { ChallengeRegistry: getRandomAddress() } as any,
    });
    expect(watcher).to.be.instanceOf(Watcher);
  });
});

describe("Watcher.initiate", () => {
  let provider: JsonRpcProvider;
  let store: ConnextStore;
  let multisigAddress: string;
  let channelBalances: { [k: string]: BigNumber };
  let freeBalance: MiniFreeBalance;
  let app: AppWithCounterClass;
  let signers: ChannelSigner[];

  let networkContext: NetworkContextForTestSuite;

  let watcher: Watcher;
  let wallet: Wallet;

  beforeEach(async () => {
    const context = await setupContext();

    // get all values needed from context
    provider = context["provider"];
    wallet = context["wallet"];
    multisigAddress = context["multisigAddress"];
    app = context["activeApps"][0];
    freeBalance = context["freeBalance"];
    channelBalances = context["channelBalances"];
    networkContext = context["networkContext"];
    signers = context["signers"];
    store = context["store"];

    // create watcher
    watcher = await Watcher.init({
      context: networkContext,
      provider,
      store,
      signer: context["wallet"].privateKey,
      logger: new ColorfulLogger("Watcher", 5, true, "A"),
    });
    expect(await store.getLatestProcessedBlock()).to.be.eq(await provider.getBlockNumber());
  });

  afterEach(async () => {
    await watcher.disable();
    await store.clear();
  });

  it("should be able to initiate + complete a dispute with a double signed latest state", async () => {
    const { outcomeSet, verifyOutcomeSet, completed, verifyCompleted } = await initiateDispute(
      app,
      freeBalance,
      watcher,
      store,
      networkContext,
    );

    const [outcomeRes] = await Promise.all([outcomeSet, provider.send("evm_mine", [])]);
    await verifyOutcomeSet(outcomeRes);
    const [completedRes] = await Promise.all([completed, provider.send("evm_mine", [])]);
    await verifyCompleted(completedRes);

    // verify final balances
    await verifyOnchainBalancesPostChallenge(multisigAddress, signers, channelBalances, wallet);
  });

  it("should be able to initiate + complete a dispute with a single signed latest state", async () => {
    // setup store with app with proper timeouts
    const {
      activeApps,
      freeBalance,
      channelBalances,
      networkContext,
      multisigAddress,
      signers,
      store,
      addActionToAppInStore,
    } = await setupContext(true, [{ defaultTimeout: One }]);
    // update app with action
    await addActionToAppInStore(store, activeApps[0]);
    // reinstantiate watcher
    watcher = await Watcher.init({
      context: networkContext,
      provider,
      store,
      signer: wallet.privateKey,
      logger: new ColorfulLogger("Watcher", 4, true, "A"),
    });

    const [initiateRes, contractEvent] = await Promise.all([
      initiateDispute(activeApps[0], freeBalance, watcher, store, networkContext, 2),
      new Promise((resolve) =>
        watcher.once(WatcherEvents.StateProgressedEvent, async (data: StateProgressedEventData) =>
          resolve(data),
        ),
      ),
    ]);
    // verify the contract event
    await verifyStateProgressedEvent(activeApps[0], contractEvent as any, networkContext);

    const { outcomeSet, verifyOutcomeSet, completed, verifyCompleted } = initiateRes as any;

    const [outcomeRes] = await Promise.all([outcomeSet, provider.send("evm_mine", [])]);
    await verifyOutcomeSet(outcomeRes);

    const [completedRes] = await Promise.all([completed, provider.send("evm_mine", [])]);
    await verifyCompleted(completedRes);

    // verify final balances
    await verifyOnchainBalancesPostChallenge(multisigAddress, signers, channelBalances, wallet);
  });
});

describe("Watcher.cancel", () => {
  let provider: JsonRpcProvider;
  let store: ConnextStore;
  let watcher: Watcher;
  let app: AppWithCounterClass;
  let freeBalance: MiniFreeBalance;
  let networkContext: NetworkContextForTestSuite;

  beforeEach(async () => {
    const context = await setupContext(true, [{ defaultTimeout: toBN(2) }]);

    // get all values needed from context
    provider = context["provider"];
    const addActionToAppInStore = context["addActionToAppInStore"];
    store = context["store"];
    app = context["activeApps"][0];
    freeBalance = context["freeBalance"];
    networkContext = context["networkContext"];

    // add action
    await addActionToAppInStore(store, app);

    // create watcher
    watcher = await Watcher.init({
      context: networkContext,
      provider,
      store,
      signer: context["wallet"].privateKey,
      // logger: new ColorfulLogger("Watcher", 5, true, "A"),
    });
    expect(await store.getLatestProcessedBlock()).to.be.eq(await provider.getBlockNumber());
  });

  afterEach(async () => {
    await watcher.disable();
    await store.clear();
  });

  it("should work if in onchain state progression phase", async () => {
    // set and progress state
    const [_, stateProgressedEvent] = await Promise.all([
      initiateDispute(app, freeBalance, watcher, store, networkContext, 2),
      new Promise((resolve) =>
        watcher.once(WatcherEvents.StateProgressedEvent, async (data: StateProgressedEventData) =>
          resolve(data),
        ),
      ),
    ]);
    await verifyStateProgressedEvent(app, stateProgressedEvent as any, networkContext);

    // cancel the challenge
    await cancelDispute(app, watcher, store);
  });

  it("should fail if in onchain set state phase", async () => {
    const {
      activeApps,
      networkContext,
      store,
      freeBalance,
      wallet,
    } = await setupContext();
    const app = activeApps[0];
    // create watcher
    watcher = await Watcher.init({
      context: networkContext,
      provider,
      store,
      signer: wallet.privateKey,
      // logger: new ColorfulLogger("Watcher", 5, true, "A"),
    });
    await initiateDispute(
      app,
      freeBalance,
      watcher,
      store,
      networkContext,
    );

    // cancel the challenge with failure flag
    await cancelDispute(app, watcher, store, `revert`);
  });

  it("should fail if outcome is set", async () => {
    // set and progress state
    const [initiateRes, stateProgressedEvent] = await Promise.all([
      initiateDispute(app, freeBalance, watcher, store, networkContext, 2),
      new Promise((resolve) =>
        watcher.once(WatcherEvents.StateProgressedEvent, async (data: StateProgressedEventData) =>
          resolve(data),
        ),
      ),
    ]);
    await verifyStateProgressedEvent(app, stateProgressedEvent as any, networkContext);

    // wait for outcome
    const { outcomeSet, verifyOutcomeSet } = initiateRes as any;
    const [outcomeRes] = await Promise.all([
      outcomeSet,
      provider.send("evm_mine", []),
    ]);
    await verifyOutcomeSet(outcomeRes);

    // cancel the challenge with failure flag
    await cancelDispute(app, watcher, store, `revert`);
  });
});

describe.skip("Watcher responses", () => {
  it("should respond with `setState` if it has a higher nonced state", async () => {});

  it("should respond with `setAndProgressState` if it has a higher nonced action", async () => {});

  it("should respond with `progressState` if it has a higher nonced action and state is set", async () => {});

  it("should fail if outcome is set", async () => {});
});
