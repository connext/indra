import {
  JsonRpcProvider,
  WatcherEvents,
  SetStateCommitmentJSON,
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
import { ChannelSigner, getRandomAddress, toBN, ColorfulLogger } from "@connext/utils";
import { initiateDispute } from "./utils/initiateDispute";
import { cancelDispute } from "./utils/cancelDispute";
import { waitForSetOutcome } from "./utils/setOutcome";
import { waitForDisputeCompletion } from "./utils/completeDispute";

const { One } = constants;

const logger = new ColorfulLogger(
  "WatcherTest",
  parseInt(process.env.LOG_LEVEL || "0", 10),
  true,
  "T",
);

describe("Watcher.init", () => {
  let providers: { [chainId: number]: JsonRpcProvider };
  let chainId: number;

  beforeEach(async () => {
    const context = await setupContext();
    providers = context["providers"];
    chainId = parseInt(Object.keys(providers)[0]);
  });

  it("should be able to instantiate with a private key", async () => {
    const watcher = await Watcher.init({
      context: { [chainId]: { ChallengeRegistry: getRandomAddress() } } as any,
      logger,
      providers,
      signer: Wallet.createRandom().privateKey,
      store: await getAndInitStore(),
    });
    expect(watcher).to.be.instanceOf(Watcher);
  });

  it("should be able to instantiate with a ChannelSigner", async () => {
    const watcher = await Watcher.init({
      logger,
      signer: new ChannelSigner(Wallet.createRandom().privateKey),
      providers,
      store: await getAndInitStore(),
      context: { [chainId]: { ChallengeRegistry: getRandomAddress() } } as any,
    });
    expect(watcher).to.be.instanceOf(Watcher);
  });
});

describe("Watcher.initiate", () => {
  let providers: { [x: number]: JsonRpcProvider };
  let store: IStoreService;
  let multisigAddress: string;
  let channelBalances: { [k: string]: BigNumber };
  let freeBalance: MiniFreeBalance;
  let app: AppWithCounterClass;
  let signers: ChannelSigner[];

  let networkContext: TestNetworkContext;

  let watcher: Watcher;
  let wallet: Wallet;
  let chainId: number;

  beforeEach(async () => {
    const context = await setupContext();

    // get all values needed from context
    providers = context["providers"];
    wallet = context["wallet"];
    multisigAddress = context["multisigAddress"];
    app = context["activeApps"][0];
    freeBalance = context["freeBalance"];
    channelBalances = context["channelBalances"];
    networkContext = context["networkContext"];
    signers = context["signers"];
    store = context["store"];
    chainId = parseInt(Object.keys(providers)[0]);

    // create watcher
    watcher = await Watcher.init({
      context: { [chainId]: networkContext },
      logger,
      providers,
      signer: context["wallet"].privateKey,
      store,
    });
    expect(await store.getLatestProcessedBlock()).to.be.eq(
      await providers[chainId].getBlockNumber(),
    );
  });

  afterEach(async () => {
    await watcher.disable();
  });

  it("should be able to initiate + complete a dispute with a double signed latest state", async () => {
    await initiateDispute(app, freeBalance, watcher, store, networkContext);
    await waitForSetOutcome(
      [app.identityHash, freeBalance.identityHash],
      watcher,
      store,
      networkContext,
    );
    await waitForDisputeCompletion(
      [app.identityHash, freeBalance.identityHash],
      watcher,
      store,
      networkContext,
    );

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
      context: { [chainId]: networkContext },
      logger,
      providers,
      signer: wallet.privateKey,
      store,
    });
    await initiateDispute(activeApps[0], freeBalance, watcher, store, networkContext, true);
    await waitForSetOutcome(
      [activeApps[0].identityHash, freeBalance.identityHash],
      watcher,
      store,
      networkContext,
    );
    await waitForDisputeCompletion(
      [activeApps[0].identityHash, freeBalance.identityHash],
      watcher,
      store,
      networkContext,
    );

    // verify final balances
    await verifyOnchainBalancesPostChallenge(multisigAddress, signers, channelBalances, wallet);
  });
});

describe("Watcher.cancel", () => {
  let providers: { [x: number]: JsonRpcProvider };
  let store: IStoreService;
  let watcher: Watcher;
  let app: AppWithCounterClass;
  let freeBalance: MiniFreeBalance;
  let networkContext: TestNetworkContext;
  let chainId: number;

  beforeEach(async () => {
    const context = await setupContext(true, [{ defaultTimeout: toBN(2) }]);

    // get all values needed from context
    providers = context["providers"];
    const addActionToAppInStore = context["addActionToAppInStore"];
    store = context["store"];
    app = context["activeApps"][0];
    freeBalance = context["freeBalance"];
    networkContext = context["networkContext"];
    chainId = parseInt(Object.keys(providers)[0]);

    // add action
    await addActionToAppInStore(store, app);

    // create watcher
    watcher = await Watcher.init({
      context: { [chainId]: networkContext },
      logger,
      providers,
      signer: context["wallet"].privateKey,
      store,
    });
    expect(await store.getLatestProcessedBlock()).to.be.eq(
      await providers[chainId].getBlockNumber(),
    );
  });

  afterEach(async () => {
    await watcher.disable();
  });

  it("should work if in onchain state progression phase", async () => {
    // set and progress state
    await initiateDispute(app, freeBalance, watcher, store, networkContext, true);

    // cancel the challenge
    await cancelDispute(app, watcher, store);
  });

  it("should fail if in onchain set state phase", async () => {
    const { activeApps, networkContext, store, freeBalance, wallet } = await setupContext();
    const app = activeApps[0];
    // create watcher
    watcher = await Watcher.init({
      context: { [chainId]: networkContext },
      logger,
      providers,
      signer: wallet.privateKey,
      store,
    });
    await initiateDispute(app, freeBalance, watcher, store, networkContext);

    // cancel the challenge with failure flag
    await cancelDispute(
      app,
      watcher,
      store,
      `cancelDispute called on challenge that cannot be cancelled`,
    );
  });

  it("should fail if outcome is set", async () => {
    // set and progress state
    await initiateDispute(app, freeBalance, watcher, store, networkContext, true);

    await mineBlock(providers[chainId]);

    // wait for outcome
    await waitForSetOutcome(
      [app.identityHash, freeBalance.identityHash],
      watcher,
      store,
      networkContext,
    );

    // cancel the challenge with failure flag
    await cancelDispute(
      app,
      watcher,
      store,
      `cancelDispute called on challenge that cannot be cancelled`,
    );
  });
});

describe("Watcher responses", () => {
  let providers: { [chainId: number]: JsonRpcProvider };
  let chainId: number;
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
    providers = context["providers"];
    chainId = parseInt(Object.keys(providers)[0]);
    store = context["store"];
    app = context["activeApps"][0];
    freeBalance = context["freeBalance"];
    networkContext = context["networkContext"];

    setState = context["setState"];
    addActionToAppInStore = context["addActionToAppInStore"];

    // create watcher
    watcher = await Watcher.init({
      context: { [chainId]: networkContext },
      logger,
      providers,
      signer: context["wallet"].privateKey,
      store,
    });
    expect(await store.getLatestProcessedBlock()).to.be.gte(
      (await providers[chainId].getBlockNumber()) - 1,
    );
  });

  afterEach(async () => {
    await watcher.disable();
  });

  it("should respond with `setState` if it has a higher nonced state", async () => {
    const setState0 = await app.getInitialSetState(networkContext.ChallengeRegistry, toBN(3));
    const expected = await app.getDoubleSignedSetState(networkContext.ChallengeRegistry);
    await setState(app, setState0);
    const [appWatcherEvent, appContractEvent] = await Promise.all([
      new Promise((resolve, reject) => {
        watcher.once(WatcherEvents.CHALLENGE_PROGRESSED_EVENT, async (data) => resolve(data));
        watcher.once(
          WatcherEvents.CHALLENGE_PROGRESSION_FAILED_EVENT,
          async (data: ChallengeProgressionFailedEventData) => reject(data),
        );
      }),
      watcher.waitFor(WatcherEvents.CHALLENGE_UPDATED_EVENT, 10_000, (data) => {
        return data.versionNumber.eq(toBN(expected.versionNumber));
      }),
      mineBlock(providers[chainId]),
    ]);
    await verifyChallengeUpdatedEvent(app, expected, appContractEvent as any, providers[chainId]);
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
        watcher.once(WatcherEvents.CHALLENGE_PROGRESSED_EVENT, async (data) => resolve(data));
        watcher.once(
          WatcherEvents.CHALLENGE_PROGRESSION_FAILED_EVENT,
          async (data: ChallengeProgressionFailedEventData) => reject(data),
        );
      }),
      watcher.waitFor(WatcherEvents.CHALLENGE_UPDATED_EVENT, 10_000, (data) => {
        return data.versionNumber.eq(toBN(expected.versionNumber));
      }),
      watcher.waitFor(WatcherEvents.STATE_PROGRESSED_EVENT, 10_000, (data) => {
        return data.identityHash === setState0.appIdentityHash;
      }),
      mineBlock(providers[chainId]),
    ]);
    await verifyChallengeUpdatedEvent(app, expected, appSetStateEvent as any, providers[chainId]);
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
        watcher.once(WatcherEvents.CHALLENGE_PROGRESSED_EVENT, async (data) => resolve(data));
        watcher.once(
          WatcherEvents.CHALLENGE_PROGRESSION_FAILED_EVENT,
          async (data: ChallengeProgressionFailedEventData) => reject(data),
        );
      }),
      watcher.waitFor(WatcherEvents.CHALLENGE_UPDATED_EVENT, 10_000, (data) => {
        return data.versionNumber.eq(toBN(expected.versionNumber));
      }),
      watcher.waitFor(WatcherEvents.STATE_PROGRESSED_EVENT, 10_000, (data) => {
        return data.identityHash === setState1.appIdentityHash;
      }),
      mineBlock(providers[chainId]),
    ]);
    await verifyChallengeUpdatedEvent(app, expected, appSetStateEvent as any, providers[chainId]);
    await verifyStateProgressedEvent(app, appActionEvent as any, networkContext);
    verifyChallengeProgressedEvent(
      app.identityHash,
      freeBalance.multisigAddress,
      appWatcherEvent as any,
    );
  });
});
