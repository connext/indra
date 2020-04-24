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
} from "@connext/types";
import { Wallet } from "ethers";

import { setupContext, expect } from "./utils";

import { Watcher } from "../src";
import { ChannelSigner, getRandomAddress, ColorfulLogger } from "@connext/utils";
import { SetStateCommitment } from "@connext/contracts";

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
  let setState: SetStateCommitment;

  let watcher: Watcher;

  beforeEach(async () => {
    const context = await setupContext();
    provider = context["provider"];
    multisigAddress = context["multisigAddress"];
    const app = context["appInstance"];
    const networkContext = context["networkContext"];
    identityHash = app.identityHash;
    setState = SetStateCommitment.fromJson(await app.getSetState(networkContext.ChallengeRegistry));
    const loadStore = context["loadStoreWithChannelAndApp"];

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
    const [contractEvent, initiatedEvent, tx] = await Promise.all([
      new Promise((resolve) =>
        watcher.once(
          WatcherEvents.ChallengeUpdatedEvent,
          async (data: ChallengeUpdatedEventPayload) => resolve(data),
        ),
      ),
      new Promise((resolve) =>
        watcher.once(
          WatcherEvents.ChallengeProgressedEvent,
          async (data: ChallengeProgressedEventData) => resolve(data),
        ),
      ),
      watcher.initiate(identityHash),
    ]);
    expect(tx).to.be.ok;

    // verify challenge
    const challenge = await store.getAppChallenge(identityHash);
    const finalizesAt = setState.stateTimeout.add(await provider.getBlockNumber());
    const expectedEvent = {
      appStateHash: setState.appStateHash,
      identityHash,
      versionNumber: setState.versionNumber,
      status: ChallengeStatus.IN_DISPUTE,
      finalizesAt,
    };
    expect(challenge).to.containSubset(expectedEvent);

    // verify stored contract event
    const setStateEvents = await store.getChallengeUpdatedEvents(identityHash);
    expect(setStateEvents.length).to.be.equal(1);
    expect(setStateEvents[0]).to.containSubset(expectedEvent);

    // verify emitted events
    expect(contractEvent).to.containSubset(expectedEvent);
    expect(initiatedEvent).to.containSubset({
      transaction: tx,
      appInstanceId: identityHash,
    });

    // wait for dispute completion
    // first block mined should call: `setOutcome`
    const [outcomeSetEvent, challengeUpdatedEvent] = await Promise.all([
      new Promise((resolve, reject) => {
        watcher.once(
          WatcherEvents.ChallengeOutcomeSetEvent,
          async (data: ChallengeOutcomeSetEventData) => resolve(data),
        );
        watcher.once(
          WatcherEvents.ChallengeOutcomeFailedEvent,
          async (data: ChallengeOutcomeFailedEventData) => reject(data),
        );
      }),
      new Promise((resolve) =>
        watcher.once(WatcherEvents.ChallengeUpdatedEvent, async (data) => resolve(data)),
      ),
      provider.send("evm_mine", []),
    ]);

    const expected = {
      ...expectedEvent,
      status: StoredAppChallengeStatus.OUTCOME_SET,
    };

    // verify stored challenge
    const setOutcomeEvents = await store.getChallengeUpdatedEvents(identityHash);
    expect(setOutcomeEvents.length).to.be.equal(2);
    expect(setOutcomeEvents[1]).to.containSubset(expected);

    // verify emitted challenges
    expect(challengeUpdatedEvent).to.containSubset({
      ...expectedEvent,
      status: StoredAppChallengeStatus.OUTCOME_SET,
    });
    const outcomeSet = await store.getAppChallenge(identityHash);
    expect(outcomeSet).to.containSubset(expected);
    expect(outcomeSetEvent).to.containSubset({
      appInstanceId: identityHash,
      multisigAddress,
    });
    expect(outcomeSetEvent.transaction).to.be.ok;

    // second block mined should call: `conditional`

    // const [disputeCompleted] = await Promise.all([
    //   new Promise((resolve, reject) => {
    //     watcher.once(
    //       WatcherEvents.ChallengeCompletedEvent,
    //       async (data: ChallengeCompletedEventData) => resolve(data),
    //     );
    //     watcher.once(
    //       WatcherEvents.ChallengeCompletionFailedEvent,
    //       async (data: ChallengeCompletionFailedEventData) => reject(data),
    //     );
    //   }),
    //   provider.send("evm_mine", []),
    // ]);
    // expect(disputeCompleted).to.containSubset({ test: "hi" });
  });
});
