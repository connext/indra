import { ConnextStore } from "@connext/store";
import {
  JsonRpcProvider,
  StoreTypes,
  BigNumber,
  ChallengeEvents,
  Address,
} from "@connext/types";
import { Wallet, Contract } from "ethers";

import {
  setupContext,
  expect,
  NetworkContextForTestSuite,
  MiniFreeBalance,
  AppWithCounterClass,
  verifyOnchainBalancesPostChallenge,
  AppWithCounterAction,
  ActionType,
} from "./utils";

import { Watcher } from "../src";
import { ChannelSigner, getRandomAddress, ColorfulLogger } from "@connext/utils";
import { initiateDispute } from "./utils/initiateDispute";
import { One } from "ethers/constants";
import { ChallengeRegistry } from "@connext/contracts";

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

describe("Watcher.initiate", () => {
  let provider: JsonRpcProvider;
  let store: ConnextStore;
  let multisigAddress: string;
  let channelBalances: { [k: string]: BigNumber };
  let freeBalance: MiniFreeBalance;
  let app: AppWithCounterClass;

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
    const loadStore = context["loadStore"];

    // create + load store
    store = new ConnextStore(StoreTypes.Memory);
    await loadStore(store);

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
    await verifyOnchainBalancesPostChallenge(
      multisigAddress,
      freeBalance.participants,
      channelBalances,
      wallet,
    );
  });

  it.only("should be able to initiate + complete a dispute with a single signed latest state", async () => {
    // setup store with app with proper timeouts
    const {
      loadStore,
      activeApps,
      freeBalance,
      channelBalances,
      networkContext,
      multisigAddress,
    } = await setupContext([{ defaultTimeout: One }]);
    // load store
    await loadStore(store);
    // update app with action
    const app = activeApps[0];
    const action: AppWithCounterAction = {
      increment: One,
      actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
    };
    app.latestAction = action;
    await store.updateAppInstance(
      multisigAddress,
      app.toJson(),
      await app.getNextSetState(networkContext.ChallengeRegistry, app.signerParticipants[0]),
    );

    // FIXME: Why does this do silly things
    const challengeRegistry = new Contract(
      networkContext.ChallengeRegistry,
      ChallengeRegistry.abi,
      wallet,
    );
    challengeRegistry.on(
      ChallengeEvents.ChallengeUpdated,
      (
        identityHash: string,
        action: string,
        versionNumber: BigNumber,
        timeout: BigNumber,
        turnTaker: Address,
        signature: string,
        event: Event,
      ) => {
        console.log(`[test] CAUGHT CHALLENGE UPDATED`, identityHash);;
      },
    );

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
    await verifyOnchainBalancesPostChallenge(
      multisigAddress,
      freeBalance.participants,
      channelBalances,
      wallet,
    );
  });
});

describe.skip("Watcher.cancel", () => {
  it("should work if in onchain set state phase", async () => {});

  it("should work if in onchain state progression phase", async () => {});

  it("should fail if outcome is set", async () => {});
});

describe.skip("Watcher responses", () => {
  it("should respond with `setState` if it has a higher nonced state", async () => {});

  it("should respond with `setAndProgressState` if it has a higher nonced action", async () => {});

  it("should respond with `progressState` if it has a higher nonced action and state is set", async () => {});

  it("should fail if outcome is set", async () => {});
});
