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
import { ChannelSigner, getRandomAddress, ColorfulLogger } from "@connext/utils";
import { SetStateCommitment, MinimumViableMultisig } from "@connext/contracts";
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
  let identityHash: string;
  let multisigAddress: string;
  let freeBalanceIdentityHash: string;
  let freeBalance: MiniFreeBalance;
  let app: AppWithCounterClass;
  let appSetState: SetStateCommitment;
  let fbSetState: SetStateCommitment;

  let networkContext: NetworkContextForTestSuite;

  let watcher: Watcher;
  let wallet: Wallet;

  beforeEach(async () => {
    const context = await setupContext();

    // get all values needed from context
    provider = context["provider"];
    wallet = context["wallet"];
    multisigAddress = context["multisigAddress"];
    app = context["appInstance"];
    freeBalance = context["freeBalance"];
    networkContext = context["networkContext"];
    freeBalanceIdentityHash = freeBalance.identityHash;
    identityHash = app.identityHash;
    appSetState = SetStateCommitment.fromJson(
      await app.getSetState(networkContext.ChallengeRegistry),
    );
    fbSetState = SetStateCommitment.fromJson(
      await freeBalance.getSetState(networkContext.ChallengeRegistry),
    );
    const loadStore = context["loadStoreWithChannelAndApp"];

    // set initial balances
    const multisigBalance = await provider.getBalance(multisigAddress);
    const signerBalances = [
      await provider.getBalance(freeBalance.participants[0]),
      await provider.getBalance(freeBalance.participants[1]),
    ];
    const totalChannelEth = app.tokenIndexedBalances[CONVENTION_FOR_ETH_ASSET_ID].reduce(
      (prev, curr) => {
        return { amount: curr.amount.add(prev.amount), to: multisigAddress };
      },
      { amount: freeBalance.ethDepositTotal, to: multisigAddress },
    ).amount;
    expect(multisigBalance).to.be.eq(totalChannelEth);
    expect(signerBalances[0]).to.be.eq(Zero);
    expect(signerBalances[1]).to.be.eq(Zero);
    expect(app.participants.toString()).to.be.eq(freeBalance.participants.toString());

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
    const empty = await store.getAppChallenge(identityHash);
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
            if (data.identityHash === freeBalanceIdentityHash) {
              resolve(data);
            }
          },
        ),
      ),
      new Promise((resolve) =>
        watcher.on(
          WatcherEvents.ChallengeUpdatedEvent,
          async (data: ChallengeUpdatedEventPayload) => {
            if (data.identityHash === identityHash) {
              resolve(data);
            }
          },
        ),
      ),
      new Promise((resolve) =>
        watcher.on(
          WatcherEvents.ChallengeProgressedEvent,
          async (data: ChallengeProgressedEventData) => {
            if (data.appInstanceId === freeBalanceIdentityHash) {
              resolve(data);
            }
          },
        ),
      ),
      new Promise((resolve) =>
        watcher.on(
          WatcherEvents.ChallengeProgressedEvent,
          async (data: ChallengeProgressedEventData) => {
            if (data.appInstanceId === identityHash) {
              resolve(data);
            }
          },
        ),
      ),
      watcher.initiate(identityHash),
    ]);
    expect(result).to.be.ok;

    // verify app + free balance challenge
    const appFinalizesAt = appSetState.stateTimeout.add(await provider.getBlockNumber());
    // fb is disputed first and automined, meaning that you should use
    // provider block - 1
    const fbFinalizesAt = fbSetState.stateTimeout.add(await provider.getBlockNumber()).sub(1);
    const expected0 = {
      [identityHash]: {
        appStateHash: appSetState.appStateHash,
        identityHash,
        versionNumber: appSetState.versionNumber,
        status: ChallengeStatus.IN_DISPUTE,
        finalizesAt: appFinalizesAt,
      },
      [freeBalanceIdentityHash]: {
        appStateHash: fbSetState.appStateHash,
        identityHash: freeBalanceIdentityHash,
        versionNumber: fbSetState.versionNumber,
        status: ChallengeStatus.IN_DISPUTE,
        finalizesAt: fbFinalizesAt,
      },
    };
    const contractEvents = {
      [identityHash]: contractEventApp,
      [freeBalanceIdentityHash]: contractEventFreeBalance,
    };
    const initiatedEvents = {
      [identityHash]: initiatedEventApp,
      [freeBalanceIdentityHash]: initiatedEventFreeBalance,
    };
    const transactions = {
      [identityHash]: (result as any).appChallenge,
      [freeBalanceIdentityHash]: (result as any).freeBalanceChallenge,
    };

    for (const appId of [identityHash, freeBalanceIdentityHash]) {
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
            if (data.appInstanceId === freeBalanceIdentityHash) {
              resolve(data);
            }
          },
        );
      }),
      new Promise((resolve, reject) => {
        watcher.on(
          WatcherEvents.ChallengeOutcomeSetEvent,
          async (data: ChallengeOutcomeSetEventData) => {
            if (data.appInstanceId === identityHash) {
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
          if (data.identityHash === freeBalanceIdentityHash) {
            resolve(data);
          }
        }),
      ),
      new Promise((resolve) =>
        watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data) => {
          if (data.identityHash === identityHash) {
            resolve(data);
          }
        }),
      ),
      provider.send("evm_mine", []),
    ]);

    const expected1 = {
      [identityHash]: {
        ...expected0[identityHash],
        status: StoredAppChallengeStatus.OUTCOME_SET,
      },
      [freeBalanceIdentityHash]: {
        ...expected0[freeBalanceIdentityHash],
        status: StoredAppChallengeStatus.OUTCOME_SET,
      },
    };
    const outcomeSetEvents = {
      [identityHash]: outcomeSetAppEvent,
      [freeBalanceIdentityHash]: outcomeSetFbEvent,
    };
    const challengeUpdatedEvents = {
      [identityHash]: challengeUpdatedAppEvent,
      [freeBalanceIdentityHash]: challengeUpdatedFbEvent,
    };

    for (const appId of [identityHash, freeBalanceIdentityHash]) {
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
            if (data.appInstanceId === identityHash) {
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
            if (data.appInstanceId === freeBalanceIdentityHash) {
              resolve(data);
            }
          },
        );
      }),
      provider.send("evm_mine", []),
    ]);
    const expected2 = {
      [identityHash]: {
        ...expected0[identityHash],
        status: StoredAppChallengeStatus.CONDITIONAL_SENT,
      },
      [freeBalanceIdentityHash]: {
        ...expected0[freeBalanceIdentityHash],
        status: StoredAppChallengeStatus.CONDITIONAL_SENT,
      },
    };
    const completedEvents = {
      [identityHash]: appDisputeCompleted,
      [freeBalanceIdentityHash]: freeBalanceDisputeCompleted,
    };
    for (const appId of [identityHash, freeBalanceIdentityHash]) {
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
    const totalChannelEth = app.tokenIndexedBalances[CONVENTION_FOR_ETH_ASSET_ID].reduce(
      (prev, curr) => {
        return { amount: curr.amount.add(prev.amount), to: multisigAddress };
      },
      { amount: freeBalance.ethDepositTotal, to: multisigAddress },
    ).amount;
    expect(withdrawn).to.be.eq(totalChannelEth);
    expect(await provider.getBalance(multisigAddress)).to.be.eq(Zero);
    expect((await provider.getBalance(freeBalance.participants[0])).toString()).to.be.eq(
      totalChannelEth,
    );
    expect((await provider.getBalance(freeBalance.participants[1])).toString()).to.be.eq(Zero);
  });
});
