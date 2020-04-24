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
} from "@connext/types";
import { Wallet } from "ethers";

import { setupContext, expect, moveToBlock } from "./utils";

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

describe.only("Watcher.initiate", () => {
  let provider: JsonRpcProvider;
  let store: ConnextStore;
  let identityHash: string;
  // let multisigAddress: string;
  let setState: SetStateCommitment;

  let watcher: Watcher;

  beforeEach(async () => {
    const context = await setupContext();
    provider = context["provider"];
    // multisigAddress = context["multisigAddress"];
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

  it("should be able to initiate + complete a dispute with a particular app instance using set state", async () => {
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
    const expectedEvent: ChallengeUpdatedEventPayload = {
      appStateHash: setState.appStateHash,
      identityHash,
      versionNumber: setState.versionNumber,
      status: ChallengeStatus.IN_DISPUTE,
      finalizesAt,
    };
    expect(challenge).to.containSubset(expectedEvent);

    // verify stored contract event
    const events = await store.getChallengeUpdatedEvents(identityHash);
    expect(events.length).to.be.equal(1);
    expect(events[0]).to.containSubset(expectedEvent);

    // verify emitted events
    expect(contractEvent).to.containSubset(expectedEvent);
    expect(initiatedEvent).to.containSubset({
      transaction: tx,
      appInstanceId: identityHash,
    });

    // wait for dispute completion
    // should call: `setOutcome`, `conditional`
    const disputeCompleted = Promise.all([
      new Promise((resolve) =>
        watcher.once(
          WatcherEvents.ChallengeOutcomeSetEvent,
          async (data: ChallengeOutcomeSetEventData) => resolve(data),
        ),
      ),
      new Promise((resolve) =>
        watcher.once(
          WatcherEvents.ChallengeCompletedEvent,
          async (data: ChallengeCompletedEventData) => resolve(data),
        ),
      ),
      new Promise((resolve, reject) =>
        watcher.once(
          WatcherEvents.ChallengeOutcomeFailedEvent,
          async (data: ChallengeOutcomeFailedEventData) => reject(data),
        ),
      ),
      new Promise((resolve, reject) =>
        watcher.once(
          WatcherEvents.ChallengeCompletionFailedEvent,
          async (data: ChallengeCompletionFailedEventData) => reject(data),
        ),
      ),
    ]);
    await moveToBlock(finalizesAt, provider);
    const [outcomeSetEvent, challengeCompletedEvent] = await disputeCompleted;

    expect(outcomeSetEvent).to.containSubset({ test: "hi" });
    expect(challengeCompletedEvent).to.containSubset({ test: "hi2" });
  });
});
