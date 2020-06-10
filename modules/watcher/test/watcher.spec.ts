import {
  JsonRpcProvider,
  WatcherEvents,
  StateProgressedEventData,
  SetStateCommitmentJSON,
  ChallengeUpdatedEventData,
  ChallengeProgressedEventData,
  ChallengeProgressionFailedEventData,
  IStoreService,
} from "@connext/types";
import { BigNumber, Wallet, constants } from "ethers";

import {
  setupContext,
  expect,
  TestNetworkContext,
  MiniFreeBalance,
  AppWithCounterClass,
  verifyOnchainBalancesPostChallenge,
  verifyStateProgressedEvent,
  verifyChallengeUpdatedEvent,
  verifyChallengeProgressedEvent,
  AppWithCounterAction,
  mineBlock,
  getAndInitStore,
} from "./utils";

import { Watcher } from "../src";
import { ChannelSigner, getRandomAddress, ColorfulLogger, toBN } from "@connext/utils";
import { initiateDispute, OutcomeSetResults } from "./utils/initiateDispute";
import { cancelDispute } from "./utils/cancelDispute";

const { One } = constants;

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
      store: await getAndInitStore(),
      context: { ChallengeRegistry: getRandomAddress() } as any,
    });
    expect(watcher).to.be.instanceOf(Watcher);
  });

  it("should be able to instantiate with a ChannelSigner", async () => {
    const watcher = await Watcher.init({
      signer: new ChannelSigner(Wallet.createRandom().privateKey, provider.connection.url),
      provider: provider,
      store: await getAndInitStore(),
      context: { ChallengeRegistry: getRandomAddress() } as any,
    });
    expect(watcher).to.be.instanceOf(Watcher);
  });
});

describe("Watcher.initiate", () => {
  let provider: JsonRpcProvider;
  let store: IStoreService;
  let multisigAddress: string;
  let channelBalances: { [k: string]: BigNumber };
  let freeBalance: MiniFreeBalance;
  let app: AppWithCounterClass;
  let signers: ChannelSigner[];

  let networkContext: TestNetworkContext;

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
      // logger: new ColorfulLogger("Watcher", 5, true, ""),
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

    const [outcomeRes] = await Promise.all([outcomeSet, mineBlock(provider)]);
    await verifyOutcomeSet(outcomeRes as OutcomeSetResults);
    const [completedRes] = await Promise.all([completed, mineBlock(provider)]);
    await verifyCompleted(completedRes as any);

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
      // logger: new ColorfulLogger("Watcher", 5, true, ""),
    });
    const [initiateRes, contractEvent] = await Promise.all([
      initiateDispute(activeApps[0], freeBalance, watcher, store, networkContext, true),
      new Promise((resolve) =>
        watcher.once(WatcherEvents.StateProgressedEvent, async (data: StateProgressedEventData) =>
          resolve(data),
        ),
      ),
    ]);
    // verify the contract event
    await verifyStateProgressedEvent(activeApps[0], contractEvent as any, networkContext);

    const { outcomeSet, verifyOutcomeSet, completed, verifyCompleted } = initiateRes as any;

    const [outcomeRes] = await Promise.all([outcomeSet, mineBlock(provider)]);
    await verifyOutcomeSet(outcomeRes);

    const [completedRes] = await Promise.all([completed, mineBlock(provider)]);
    await verifyCompleted(completedRes);

    // verify final balances
    await verifyOnchainBalancesPostChallenge(multisigAddress, signers, channelBalances, wallet);
  });
});

describe("Watcher.cancel", () => {
  let provider: JsonRpcProvider;
  let store: IStoreService;
  let watcher: Watcher;
  let app: AppWithCounterClass;
  let freeBalance: MiniFreeBalance;
  let networkContext: TestNetworkContext;

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
      // logger: new ColorfulLogger("Watcher", 3, true, ""),
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
      initiateDispute(app, freeBalance, watcher, store, networkContext, true),
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
    const { activeApps, networkContext, store, freeBalance, wallet } = await setupContext();
    const app = activeApps[0];
    // create watcher
    watcher = await Watcher.init({
      context: networkContext,
      provider,
      store,
      signer: wallet.privateKey,
    });
    await initiateDispute(app, freeBalance, watcher, store, networkContext);

    // cancel the challenge with failure flag
    await cancelDispute(app, watcher, store, `revert`);
  });

  it("should fail if outcome is set", async () => {
    // set and progress state
    const [initiateRes, stateProgressedEvent] = await Promise.all([
      initiateDispute(app, freeBalance, watcher, store, networkContext, true),
      new Promise((resolve) =>
        watcher.once(WatcherEvents.StateProgressedEvent, async (data: StateProgressedEventData) =>
          resolve(data),
        ),
      ),
    ]);
    await verifyStateProgressedEvent(app, stateProgressedEvent as any, networkContext);

    // wait for outcome
    await mineBlock(provider);

    const { outcomeSet, verifyOutcomeSet } = initiateRes as any;
    const [outcomeRes] = await Promise.all([outcomeSet, mineBlock(provider)]);
    await verifyOutcomeSet(outcomeRes);

    // cancel the challenge with failure flag
    await cancelDispute(app, watcher, store, `revert`);
  });
});

describe("Watcher responses", () => {
  let provider: JsonRpcProvider;
  let store: IStoreService;
  let watcher: Watcher;
  let app: AppWithCounterClass;
  let freeBalance: MiniFreeBalance;
  let networkContext: TestNetworkContext;

  let setState: (app: AppWithCounterClass, commitment: SetStateCommitmentJSON) => Promise<void>;
  let addActionToAppInStore: (
    store: IStoreService,
    appPriorToAction: AppWithCounterClass,
    action?: AppWithCounterAction,
  ) => Promise<AppWithCounterClass>;

  beforeEach(async () => {
    const context = await setupContext(true, [{ defaultTimeout: toBN(3) }]);

    // get all values needed from context
    provider = context["provider"];
    store = context["store"];
    app = context["activeApps"][0];
    freeBalance = context["freeBalance"];
    networkContext = context["networkContext"];

    setState = context["setState"];
    addActionToAppInStore = context["addActionToAppInStore"];

    // create watcher
    watcher = await Watcher.init({
      context: networkContext,
      provider,
      store,
      signer: context["wallet"].privateKey,
      // logger: new ColorfulLogger("Watcher", 5, true, ""),
    });
    expect(await store.getLatestProcessedBlock()).to.be.eq(await provider.getBlockNumber());
  });

  afterEach(async () => {
    await watcher.disable();
    await store.clear();
  });

  it("should respond with `setState` if it has a higher nonced state", async () => {
    const setState0 = await app.getInitialSetState(networkContext.ChallengeRegistry, toBN(3));
    const expected = await app.getDoubleSignedSetState(networkContext.ChallengeRegistry);
    await setState(app, setState0);
    const [appWatcherEvent, appContractEvent] = await Promise.all([
      new Promise((resolve, reject) => {
        watcher.on(
          WatcherEvents.ChallengeProgressedEvent,
          async (data: ChallengeProgressedEventData) => resolve(data),
        );
        watcher.on(
          WatcherEvents.ChallengeProgressionFailedEvent,
          async (data: ChallengeProgressionFailedEventData) => reject(data),
        );
      }),
      new Promise((resolve) => {
        watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data: ChallengeUpdatedEventData) => {
          if (data.versionNumber.eq(toBN(expected.versionNumber))) {
            resolve(data);
          }
        });
      }),
      mineBlock(provider),
    ]);
    await verifyChallengeUpdatedEvent(app, expected, appContractEvent as any, provider);
    verifyChallengeProgressedEvent(
      app.identityHash,
      freeBalance.multisigAddress,
      appWatcherEvent as any,
    );
  });
  it("should respond with `setAndProgressState` if it has a higher nonced action", async () => {
    // add action to store
    app = await addActionToAppInStore(store, app);

    // set initial state
    const setState0 = await app.getInitialSetState(networkContext.ChallengeRegistry, toBN(3));
    const expected = await app.getSingleSignedSetState(networkContext.ChallengeRegistry);
    await setState(app, setState0);

    const [appWatcherEvent, appSetStateEvent, appProgressStateEvent] = await Promise.all([
      new Promise((resolve, reject) => {
        watcher.on(
          WatcherEvents.ChallengeProgressedEvent,
          async (data: ChallengeProgressedEventData) => resolve(data),
        );
        watcher.on(
          WatcherEvents.ChallengeProgressionFailedEvent,
          async (data: ChallengeProgressionFailedEventData) => reject(data),
        );
      }),
      new Promise((resolve) => {
        watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data: ChallengeUpdatedEventData) => {
          if (data.versionNumber.eq(toBN(expected.versionNumber))) {
            resolve(data);
          }
        });
      }),
      new Promise((resolve) => {
        watcher.on(WatcherEvents.StateProgressedEvent, async (data: StateProgressedEventData) =>
          resolve(data),
        );
      }),
      mineBlock(provider),
    ]);
    await verifyChallengeUpdatedEvent(app, expected, appSetStateEvent as any, provider);
    await verifyStateProgressedEvent(app, appProgressStateEvent as any, networkContext);
    verifyChallengeProgressedEvent(
      app.identityHash,
      freeBalance.multisigAddress,
      appWatcherEvent as any,
    );
  });

  it("should respond with `progressState` if it has a higher nonced action and state is set", async () => {
    // add action to store
    app = await addActionToAppInStore(store, app);

    // set state with previous state
    const setState1 = await app.getDoubleSignedSetState(networkContext.ChallengeRegistry);
    const expected = await app.getSingleSignedSetState(networkContext.ChallengeRegistry);
    await setState(app, setState1);
    const [appWatcherEvent, appSetStateEvent, appActionEvent] = await Promise.all([
      new Promise((resolve, reject) => {
        watcher.on(
          WatcherEvents.ChallengeProgressedEvent,
          async (data: ChallengeProgressedEventData) => resolve(data),
        );
        watcher.on(
          WatcherEvents.ChallengeProgressionFailedEvent,
          async (data: ChallengeProgressionFailedEventData) => reject(data),
        );
      }),
      new Promise((resolve) => {
        watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data: ChallengeUpdatedEventData) => {
          if (data.versionNumber.eq(toBN(expected.versionNumber))) {
            resolve(data);
          }
        });
      }),
      new Promise((resolve) => {
        watcher.on(WatcherEvents.StateProgressedEvent, async (data: StateProgressedEventData) =>
          resolve(data),
        );
      }),
      mineBlock(provider),
    ]);
    await verifyChallengeUpdatedEvent(app, expected, appSetStateEvent as any, provider);
    await verifyStateProgressedEvent(app, appActionEvent as any, networkContext);
    verifyChallengeProgressedEvent(
      app.identityHash,
      freeBalance.multisigAddress,
      appWatcherEvent as any,
    );
  });
});
