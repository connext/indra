import { Watcher } from "../../src";
import {
  IStoreService,
  WatcherEvents,
  ChallengeUpdatedEventPayload,
  ChallengeStatus,
  ChallengeCompletedEventData,
  ChallengeOutcomeSetEventData,
} from "@connext/types";
import { toBN, delay } from "@connext/utils";
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
  store: IStoreService,
  networkContext: TestNetworkContext,
  callSetAndProgress: boolean = false,
) => {
  // Verify the challenge does not exist
  const empty = await store.getAppChallenge(app.identityHash);
  expect(empty).to.be.undefined;

  // Get expected values for free balance and app
  const appSetState = callSetAndProgress
    ? await app.getSingleSignedSetState(networkContext.ChallengeRegistry)
    : await app.getDoubleSignedSetState(networkContext.ChallengeRegistry);

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
          WatcherEvents.CHALLENGE_UPDATED_EVENT,
          EVENT_TIMEOUT,
          matchesId,
        );
        return resolve([event]);
      }
      // calls `setAndProgress` and should emit two ChallengeUpdated events
      // as well as one StateProgressed event
      const events = await Promise.all([
        watcher.waitFor(
          WatcherEvents.CHALLENGE_UPDATED_EVENT,
          EVENT_TIMEOUT,
          (data) =>
            matchesId(data, app.identityHash) &&
            data.versionNumber.eq(toBN(appSetState.versionNumber)),
        ),
        watcher.waitFor(
          WatcherEvents.CHALLENGE_UPDATED_EVENT,
          EVENT_TIMEOUT,
          (data) =>
            matchesId(data, app.identityHash) &&
            data.versionNumber.eq(toBN(appSetState.versionNumber).sub(1)),
        ),
        watcher.waitFor(WatcherEvents.STATE_PROGRESSED_EVENT, EVENT_TIMEOUT, matchesId),
      ]);
      const sorted = events.sort((a, b) => a.versionNumber.sub(b.versionNumber).toNumber());
      return resolve(sorted);
    }),
    // contract event for dispute initiation of free balance
    watcher.waitFor(WatcherEvents.CHALLENGE_UPDATED_EVENT, EVENT_TIMEOUT, matchesFb),
    // watcher event for dispute initiation
    watcher.waitFor(WatcherEvents.CHALLENGE_PROGRESSED_EVENT, EVENT_TIMEOUT, matchesId),
    // watcher event for dispute initiation
    watcher.waitFor(WatcherEvents.CHALLENGE_PROGRESSED_EVENT, EVENT_TIMEOUT, matchesFb),
    // watcher api ret
    watcher.initiate(app.identityHash),
  ]);

  await delay(1000);

  // Verify watcher return values
  expect(watcherReturn.freeBalanceChallenge.hash).to.be.ok;
  expect(watcherReturn.appChallenge.hash).to.be.ok;

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
  const fbFinalizesAt = toBN(await networkContext.provider.getBlockNumber())
    .add(freeBalance.stateTimeout)
    .sub(1); // ganache-trickery from 2 tx sends

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
      await transactions[appId].wait(),
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
      const sorted = challengeUpdated.sort((a, b) =>
        toBN(a.versionNumber).sub(toBN(b.versionNumber)).toNumber(),
      );
      expect(sorted.length).to.be.eq(2);
      expect(sorted[0]).to.containSubset({
        status: ChallengeStatus.IN_DISPUTE,
        identityHash: appId,
        versionNumber: toBN(expected[appId].versionNumber).sub(1),
      });
      await verifyStateProgressedEvent(app, stateProgressed[0], networkContext);
      expect(sorted[1]).to.containSubset(expected[appId]);
    }
  }
  return;
};
