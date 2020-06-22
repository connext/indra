import { Watcher } from "../../src";
import {
  IWatcherStoreService,
  WatcherEvents,
  ChallengeUpdatedEventPayload,
  ChallengeProgressedEventData,
  ChallengeStatus,
  ChallengeCompletedEventData,
  ChallengeCompletionFailedEventData,
  ChallengeOutcomeFailedEventData,
  ChallengeOutcomeSetEventData,
  StoredAppChallengeStatus,
  StateProgressedEventData,
  SetStateCommitmentJSON,
} from "@connext/types";
import { bigNumberifyJson, toBN } from "@connext/utils";
import { constants } from "ethers";

import { expect } from ".";
import { AppWithCounterClass } from "./appWithCounter";
import { MiniFreeBalance } from "./miniFreeBalance";
import { TestNetworkContext } from "./contracts";
import { verifyChallengeProgressedEvent, verifyStateProgressedEvent } from "./assertions";

const { Zero } = constants;

export type OutcomeSetResults = [
  ChallengeOutcomeSetEventData,
  ChallengeOutcomeSetEventData,
  ChallengeUpdatedEventPayload,
  ChallengeUpdatedEventPayload,
];

export type ChallengeCompleteResults = [ChallengeCompletedEventData, ChallengeCompletedEventData];

export const initiateDispute = async (
  app: AppWithCounterClass,
  freeBalance: MiniFreeBalance,
  watcher: Watcher,
  store: IWatcherStoreService,
  networkContext: TestNetworkContext,
  callSetAndProgress: boolean = false,
) => {
  // Verify the challenge does not exist
  const empty = await store.getAppChallenge(app.identityHash);
  expect(empty).to.be.undefined;

  // Initiate dispute and catch all watcher events
  const matchesId = (data: any, id: string = app.identityHash) => {
    const emitted = data["identityHash"] || data["appInstanceId"];
    return emitted && emitted === id;
  };
  const matchesFb = (data: any) => matchesId(data, freeBalance.identityHash);
  const EVENT_TIMEOUT = 10_000;
  const [contractApp, contractFb, initiatedApp, initiatedFb, watcherReturn] = await Promise.all([
    // contract events for dispute initiation of app
    new Promise(async (resolve) => {
      if (!callSetAndProgress) {
        // calls `setState` and should emit one ChallengeUpdated event
        const event = await watcher.waitFor(
          WatcherEvents.ChallengeUpdatedEvent,
          EVENT_TIMEOUT,
          matchesId,
        );
        return resolve([event]);
      }
      // calls `setAndProgress` and should emit two ChallengeUpdated events
      // as well as one StateProgressed event
      const events = await Promise.all([
        watcher.waitFor(WatcherEvents.ChallengeUpdatedEvent, EVENT_TIMEOUT, matchesId),
        watcher.waitFor(WatcherEvents.ChallengeUpdatedEvent, EVENT_TIMEOUT, matchesId),
        watcher.waitFor(WatcherEvents.StateProgressedEvent, EVENT_TIMEOUT, matchesId),
      ]);
      const sorted = events.sort((a, b) => a.versionNumber.sub(b.versionNumber).toNumber());
      return resolve(sorted);
    }),
    // contract event for dispute initiation of free balance
    watcher.waitFor(WatcherEvents.ChallengeUpdatedEvent, EVENT_TIMEOUT, matchesFb),
    // watcher event for dispute initiation
    watcher.waitFor(WatcherEvents.ChallengeProgressedEvent, EVENT_TIMEOUT, matchesId),
    // watcher event for dispute initiation
    watcher.waitFor(WatcherEvents.ChallengeProgressedEvent, EVENT_TIMEOUT, matchesFb),
    // watcher api ret
    watcher.initiate(app.identityHash),
  ]);

  // Verify watcher return values
  expect(watcherReturn.freeBalanceChallenge.transactionHash).to.be.ok;
  expect(watcherReturn.appChallenge.transactionHash).to.be.ok;

  // Get expected values for free balance and app
  const appSetState: SetStateCommitmentJSON = callSetAndProgress
    ? await app.getSingleSignedSetState(networkContext.ChallengeRegistry)
    : await app.getDoubleSignedSetState(networkContext.ChallengeRegistry);
  const status = app.isStateTerminal()
    ? ChallengeStatus.EXPLICITLY_FINALIZED
    : callSetAndProgress
    ? ChallengeStatus.IN_ONCHAIN_PROGRESSION
    : ChallengeStatus.IN_DISPUTE;
  // get expected app values
  const appFinalizesAt = toBN(await networkContext.provider.getBlockNumber())
    .add(app.stateTimeout)
    .add(callSetAndProgress ? app.defaultTimeout : Zero);

  // get expected free balance values
  const fbSetState = await freeBalance.getSetState();
  const fbFinalizesAt = freeBalance.stateTimeout.add(
    await networkContext.provider.getBlockNumber(),
  );
  // .sub(1);

  const expected = {
    [app.identityHash]: {
      appStateHash: appSetState.appStateHash,
      identityHash: app.identityHash,
      versionNumber: appSetState.versionNumber,
      status,
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

  // Gather promise events
  const challengeProgressedEvents = {
    [app.identityHash]: initiatedApp,
    [freeBalance.identityHash]: initiatedFb,
  };
  const transactions = {
    [app.identityHash]: watcherReturn.appChallenge,
    [freeBalance.identityHash]: watcherReturn.freeBalanceChallenge,
  };
  const contractEvents = {
    [app.identityHash]: contractApp,
    [freeBalance.identityHash]: [contractFb],
  };

  for (const appId of [app.identityHash, freeBalance.identityHash]) {
    // Verify watcher events
    verifyChallengeProgressedEvent(
      appId,
      freeBalance.multisigAddress,
      challengeProgressedEvents[appId],
      transactions[appId],
    );

    // Verify stored challenge
    const challenge = await store.getAppChallenge(appId);
    expect(challenge).to.containSubset(expected[appId]);

    // Verify stored contract events
    const [challengeUpdated, stateProgressed] = await Promise.all([
      store.getChallengeUpdatedEvents(appId),
      store.getStateProgressedEvents(appId),
    ]);
    const emitted = contractEvents[appId] as any[];
    if (emitted.length === 1) {
      // called `setState` in dispute path for appId
      expect(challengeUpdated.length).to.be.eql(emitted.length);
      expect(stateProgressed).to.be.deep.eq([]);
      expect(challengeUpdated[0]).to.containSubset(expected[appId]);
    } else {
      // called `setAndProgressState` in dispute path for appId
      // emitted events are sorted by version number from low - high
      expect(challengeUpdated.length).to.be.eq(2);
      expect(challengeUpdated[0]).to.containSubset({
        status: ChallengeStatus.IN_DISPUTE,
        identityHash: appId,
        versionNumber: toBN(expected[appId].versionNumber).sub(1),
      });
      await verifyStateProgressedEvent(app, stateProgressed as any, networkContext);
      expect(challengeUpdated[1]).to.containSubset(expected[appId]);
    }
  }
  return;
};

export const initiateDisputeOld = async (
  app: AppWithCounterClass,
  freeBalance: MiniFreeBalance,
  watcher: Watcher,
  store: IWatcherStoreService,
  networkContext: TestNetworkContext,
  shouldCallSetAndProgress: boolean = false,
) => {
  // before starting, verify empty store
  const empty = await store.getAppChallenge(app.identityHash);
  expect(empty).to.be.undefined;
  // setup event counters
  let appChallengeUpdatedEventsCaught = 0;
  watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data: ChallengeUpdatedEventPayload) => {
    if (data.identityHash === app.identityHash) {
      appChallengeUpdatedEventsCaught += 1;
    }
  });

  // get expected nonce to resolve at
  const appSetState = bigNumberifyJson(
    shouldCallSetAndProgress
      ? await app.getSingleSignedSetState(networkContext.ChallengeRegistry)
      : await app.getDoubleSignedSetState(networkContext.ChallengeRegistry),
  );

  const [
    contractEventFreeBalance,
    finalContractEventApp,
    initiatedEventFreeBalance,
    initiatedEventApp,
    result,
    stateProgressedEventApp,
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
          if (
            data.identityHash === app.identityHash &&
            data.versionNumber.eq(toBN(appSetState.versionNumber))
          ) {
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
    new Promise((resolve) => {
      if (shouldCallSetAndProgress) {
        watcher.on(WatcherEvents.StateProgressedEvent, async (data: StateProgressedEventData) =>
          resolve(data),
        );
      } else {
        resolve(undefined);
      }
    }),
  ]);
  expect(result).to.be.ok;

  // verify app + free balance challenge
  const isStateTerminal = app.latestState.counter.gt(5);
  // get expected app values
  const appFinalizesAt = toBN(await networkContext.provider.getBlockNumber())
    .add(appSetState.stateTimeout)
    .add(shouldCallSetAndProgress ? app.defaultTimeout : Zero);
  const appStatus = !shouldCallSetAndProgress
    ? ChallengeStatus.IN_DISPUTE
    : isStateTerminal
    ? ChallengeStatus.EXPLICITLY_FINALIZED
    : ChallengeStatus.IN_ONCHAIN_PROGRESSION;

  // get expected free balance values
  const fbSetState = bigNumberifyJson(await freeBalance.getSetState());
  // fb is disputed first and automined, meaning that you should use
  // provider block - 1
  const fbFinalizesAt = fbSetState.stateTimeout
    .add(await networkContext.provider.getBlockNumber())
    .sub(1);

  const expected0 = {
    [app.identityHash]: {
      appStateHash: appSetState.appStateHash,
      identityHash: app.identityHash,
      versionNumber: appSetState.versionNumber,
      status: appStatus,
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
    [app.identityHash]: finalContractEventApp,
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
    if (appId === freeBalance.identityHash) {
      // free balance always has one set state event
      expect(setStateEvents.length).to.be.equal(1);
      expect(setStateEvents[0]).to.containSubset(expected0[appId]);
    } else {
      expect(setStateEvents.length).to.be.equal(appChallengeUpdatedEventsCaught);
      const final = setStateEvents.find((event) =>
        toBN(event.versionNumber).eq(appSetState.versionNumber),
      );
      expect(final).to.containSubset(expected0[appId]);
    }

    // verify emitted events
    verifyChallengeProgressedEvent(
      appId,
      freeBalance.multisigAddress,
      initiatedEvents[appId] as any,
      transactions[appId],
    );
    expect(contractEvents[appId]).to.containSubset(expected0[appId]);
  }

  if (stateProgressedEventApp) {
    // verify action event
    expect(stateProgressedEventApp).to.containSubset({
      identityHash: app.identityHash,
      action: AppWithCounterClass.encodeAction(app.latestAction!),
    });
  }

  // after first dispute, create and return other promises for other
  // dispute phases
  const outcomeSet = (Promise.all([
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
          if (
            data.identityHash === app.identityHash &&
            data.status === ChallengeStatus.OUTCOME_SET
          ) {
            resolve(data);
          }
        },
      ),
    ),
  ]) as unknown) as OutcomeSetResults;
  const verifyOutcomeSet = async (results: OutcomeSetResults) => {
    const [
      outcomeSetFbEvent,
      outcomeSetAppEvent,
      challengeUpdatedFbEvent,
      challengeUpdatedAppEvent,
    ] = results;
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
      if (appId === freeBalance.identityHash) {
        // free balance always has one set state event
        expect(events.length).to.be.equal(2);
        expect(events.pop()).to.containSubset(expected1[appId]);
      } else {
        expect(events.length).to.be.at.least(appChallengeUpdatedEventsCaught);
        expect(
          events.find(
            (event) =>
              toBN(event.versionNumber).eq(appSetState.versionNumber) &&
              event.status === ChallengeStatus.OUTCOME_SET,
          ),
        ).to.containSubset(expected1[appId]);
      }

      // verify stored challenges
      const challenge = await store.getAppChallenge(appId);
      expect(challenge).to.containSubset(expected1[appId]);

      // verify emitted events
      expect(outcomeSetEvents[appId]).to.containSubset({
        appInstanceId: appId,
        multisigAddress: freeBalance.multisigAddress,
      });
      expect(outcomeSetEvents[appId].transaction).to.be.ok;
      expect(challengeUpdatedEvents[appId]).to.containSubset(expected1[appId]);
    }
  };

  const completed = (Promise.all([
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
  ]) as unknown) as ChallengeCompleteResults;
  const verifyCompleted = async (res: ChallengeCompleteResults) => {
    const [appDisputeCompleted, freeBalanceDisputeCompleted] = res;
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
        multisigAddress: freeBalance.multisigAddress,
      });
    }
  };

  return {
    outcomeSet,
    verifyOutcomeSet,
    completed,
    verifyCompleted,
  };
};
