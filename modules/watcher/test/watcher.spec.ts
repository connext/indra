import { ConnextStore } from "@connext/store";
import {
  JsonRpcProvider,
  StoreTypes,
  ChallengeStatus,
  WatcherEvents,
  ChallengeProgressedEventData,
  ChallengeUpdatedEventPayload,
  ChallengeOutcomeSetEventData,
  ChallengeCompletedEventData,
  ChallengeOutcomeFailedEventData,
  ChallengeCompletionFailedEventData,
  StoredAppChallengeStatus,
  CONVENTION_FOR_ETH_ASSET_ID,
  BigNumber,
} from "@connext/types";
import { Wallet, Contract } from "ethers";

import {
  setupContext,
  expect,
  NetworkContextForTestSuite,
  MiniFreeBalance,
  AppWithCounterClass,
} from "./utils";

import { Watcher } from "../src";
import { ChannelSigner, getRandomAddress, ColorfulLogger, bigNumberifyJson } from "@connext/utils";
import { MinimumViableMultisig } from "@connext/contracts";
import { Zero } from "ethers/constants";

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
    const activeApps = context["activeApps"];
    app = activeApps[0];
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

  it.only("should be able to initiate + complete a dispute with a particular app instance using set state", async () => {
    // start mining
    const empty = await store.getAppChallenge(app.identityHash);
    expect(empty).to.be.undefined;
    const [
      contractEventFreeBalance,
      contractEventApp,
      initiatedEventFreeBalance,
      initiatedEventApp,
      result,
    ] = await Promise.all([
      new Promise((resolve) =>
        watcher.on(
          WatcherEvents.ChallengeUpdatedEvent,
          async (data: ChallengeUpdatedEventPayload) => {
            if (data.identityHash === freeBalance.identityHash) {
              resolve(data);
            }
          },
        ),
      ),
      new Promise((resolve) =>
        watcher.on(
          WatcherEvents.ChallengeUpdatedEvent,
          async (data: ChallengeUpdatedEventPayload) => {
            if (data.identityHash === app.identityHash) {
              resolve(data);
            }
          },
        ),
      ),
      new Promise((resolve) =>
        watcher.on(
          WatcherEvents.ChallengeProgressedEvent,
          async (data: ChallengeProgressedEventData) => {
            if (data.appInstanceId === freeBalance.identityHash) {
              resolve(data);
            }
          },
        ),
      ),
      new Promise((resolve) =>
        watcher.on(
          WatcherEvents.ChallengeProgressedEvent,
          async (data: ChallengeProgressedEventData) => {
            if (data.appInstanceId === app.identityHash) {
              resolve(data);
            }
          },
        ),
      ),
      watcher.initiate(app.identityHash),
    ]);
    expect(result).to.be.ok;

    // verify app + free balance challenge
    const appSetState = bigNumberifyJson(
      await app.getCurrentSetState(networkContext.ChallengeRegistry),
    );
    const fbSetState = bigNumberifyJson(await freeBalance.getSetState());
    const appFinalizesAt = appSetState.stateTimeout.add(await provider.getBlockNumber());
    // fb is disputed first and automined, meaning that you should use
    // provider block - 1
    const fbFinalizesAt = fbSetState.stateTimeout.add(await provider.getBlockNumber()).sub(1);
    const expected0 = {
      [app.identityHash]: {
        appStateHash: appSetState.appStateHash,
        identityHash: app.identityHash,
        versionNumber: appSetState.versionNumber,
        status: ChallengeStatus.IN_DISPUTE,
        finalizesAt: appFinalizesAt,
      },
      [freeBalance.identityHash]: {
        appStateHash: fbSetState.appStateHash,
        identityHash: freeBalance.identityHash,
        versionNumber: fbSetState.versionNumber,
        status: ChallengeStatus.IN_DISPUTE,
        finalizesAt: fbFinalizesAt,
      },
    };
    const contractEvents = {
      [app.identityHash]: contractEventApp,
      [freeBalance.identityHash]: contractEventFreeBalance,
    };
    const initiatedEvents = {
      [app.identityHash]: initiatedEventApp,
      [freeBalance.identityHash]: initiatedEventFreeBalance,
    };
    const transactions = {
      [app.identityHash]: (result as any).appChallenge,
      [freeBalance.identityHash]: (result as any).freeBalanceChallenge,
    };

    for (const appId of [app.identityHash, freeBalance.identityHash]) {
      // verify stored challenge
      const challenge = await store.getAppChallenge(appId);
      expect(challenge).to.containSubset(expected0[appId]);

      // verify stored contract event
      const setStateEvents = await store.getChallengeUpdatedEvents(appId);
      expect(setStateEvents.length).to.be.equal(1);
      expect(setStateEvents[0]).to.containSubset(expected0[appId]);

      // verify emitted events
      expect(contractEvents[appId]).to.containSubset(expected0[appId]);
      expect(initiatedEvents[appId]).to.containSubset({
        transaction: transactions[appId],
        appInstanceId: appId,
      });
    }

    // wait for app dispute completion
    // first block mined should call: `setOutcome`
    const [
      outcomeSetFbEvent,
      outcomeSetAppEvent,
      challengeUpdatedFbEvent,
      challengeUpdatedAppEvent,
    ] = await Promise.all([
      new Promise((resolve) => {
        watcher.on(
          WatcherEvents.ChallengeOutcomeSetEvent,
          async (data: ChallengeOutcomeSetEventData) => {
            if (data.appInstanceId === freeBalance.identityHash) {
              resolve(data);
            }
          },
        );
      }),
      new Promise((resolve, reject) => {
        watcher.on(
          WatcherEvents.ChallengeOutcomeSetEvent,
          async (data: ChallengeOutcomeSetEventData) => {
            if (data.appInstanceId === app.identityHash) {
              resolve(data);
            }
          },
        );
        watcher.once(
          WatcherEvents.ChallengeOutcomeFailedEvent,
          async (data: ChallengeOutcomeFailedEventData) => reject(data),
        );
      }),
      new Promise((resolve) =>
        watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data) => {
          if (data.identityHash === freeBalance.identityHash) {
            resolve(data);
          }
        }),
      ),
      new Promise((resolve) =>
        watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data) => {
          if (data.identityHash === app.identityHash) {
            resolve(data);
          }
        }),
      ),
      provider.send("evm_mine", []),
    ]);

    const expected1 = {
      [app.identityHash]: {
        ...expected0[app.identityHash],
        status: StoredAppChallengeStatus.OUTCOME_SET,
      },
      [freeBalance.identityHash]: {
        ...expected0[freeBalance.identityHash],
        status: StoredAppChallengeStatus.OUTCOME_SET,
      },
    };
    const outcomeSetEvents = {
      [app.identityHash]: outcomeSetAppEvent,
      [freeBalance.identityHash]: outcomeSetFbEvent,
    };
    const challengeUpdatedEvents = {
      [app.identityHash]: challengeUpdatedAppEvent,
      [freeBalance.identityHash]: challengeUpdatedFbEvent,
    };

    for (const appId of [app.identityHash, freeBalance.identityHash]) {
      // verify stored events
      const events = await store.getChallengeUpdatedEvents(appId);
      expect(events.length).to.be.equal(2);
      expect(events[1]).to.containSubset(expected1[appId]);

      // verify stored challenges
      const challenge = await store.getAppChallenge(appId);
      expect(challenge).to.containSubset(expected1[appId]);

      // verify emitted events
      expect(outcomeSetEvents[appId]).to.containSubset({
        appInstanceId: appId,
        multisigAddress,
      });
      expect(outcomeSetEvents[appId].transaction).to.be.ok;
      expect(challengeUpdatedEvents[appId]).to.containSubset(expected1[appId]);
    }

    // second block mined should call: `conditional`
    const [appDisputeCompleted, freeBalanceDisputeCompleted] = await Promise.all([
      new Promise((resolve, reject) => {
        watcher.on(
          WatcherEvents.ChallengeCompletedEvent,
          async (data: ChallengeCompletedEventData) => {
            if (data.appInstanceId === app.identityHash) {
              resolve(data);
            }
          },
        );
        watcher.once(
          WatcherEvents.ChallengeCompletionFailedEvent,
          async (data: ChallengeCompletionFailedEventData) => reject(data),
        );
      }),
      new Promise((resolve) => {
        watcher.on(
          WatcherEvents.ChallengeCompletedEvent,
          async (data: ChallengeCompletedEventData) => {
            if (data.appInstanceId === freeBalance.identityHash) {
              resolve(data);
            }
          },
        );
      }),
      provider.send("evm_mine", []),
    ]);
    const expected2 = {
      [app.identityHash]: {
        ...expected0[app.identityHash],
        status: StoredAppChallengeStatus.CONDITIONAL_SENT,
      },
      [freeBalance.identityHash]: {
        ...expected0[freeBalance.identityHash],
        status: StoredAppChallengeStatus.CONDITIONAL_SENT,
      },
    };
    const completedEvents = {
      [app.identityHash]: appDisputeCompleted,
      [freeBalance.identityHash]: freeBalanceDisputeCompleted,
    };
    for (const appId of [app.identityHash, freeBalance.identityHash]) {
      // verify stored challenge
      const challenge = await store.getAppChallenge(appId);
      expect(challenge).to.containSubset(expected2[appId]);

      // verify emitted events
      expect(completedEvents[appId]).to.containSubset({
        appInstanceId: appId,
        multisigAddress,
      });
    }

    // verify final balances
    const withdrawn = await new Contract(
      multisigAddress,
      MinimumViableMultisig.abi,
      wallet,
    ).functions.totalAmountWithdrawn(CONVENTION_FOR_ETH_ASSET_ID);
    expect(withdrawn).to.be.eq(channelBalances[CONVENTION_FOR_ETH_ASSET_ID]);
    expect(await provider.getBalance(multisigAddress)).to.be.eq(Zero);
    expect((await provider.getBalance(freeBalance.participants[0])).toString()).to.be.eq(
      channelBalances[CONVENTION_FOR_ETH_ASSET_ID],
    );
    expect((await provider.getBalance(freeBalance.participants[1])).toString()).to.be.eq(Zero);
  });
});
