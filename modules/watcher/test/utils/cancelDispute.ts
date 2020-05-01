import { AppWithCounterClass } from "./appWithCounter";
import { Watcher } from "../../src";
import {
  IWatcherStoreService,
  WatcherEvents,
  ChallengeCancellationFailedEventData,
  ChallengeCancelledEventData,
  ChallengeUpdatedEventData,
} from "@connext/types";
import { expect } from ".";
import { verifyCancelChallenge } from "./assertions";
import { stringify } from "@connext/utils";

export const cancelDispute = async (
  app: AppWithCounterClass,
  watcher: Watcher,
  store: IWatcherStoreService,
) => {
  const existing = await store.getAppChallenge(app.identityHash);
  expect(existing).to.be.ok;
  console.log(`stored existing`, stringify(existing));
  const [watcherEvent, challengeUpdated, watcherRes] = await Promise.all([
    new Promise((resolve, reject) => {
      watcher.once(
        WatcherEvents.ChallengeCancellationFailedEvent,
        async (data: ChallengeCancellationFailedEventData) => reject(data),
      );
      watcher.once(
        WatcherEvents.ChallengeCancelledEvent,
        async (data: ChallengeCancelledEventData) => resolve(data),
      );
    }),
    new Promise((resolve) => {
      watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data: ChallengeUpdatedEventData) => {
        if (data.identityHash === app.identityHash) {
          resolve(data);
        }
      });
    }),
    watcher.cancel(
      app.identityHash,
      await app.getCancelDisputeRequest(existing!.versionNumber),
    ),
  ]);
  // verify watcher event
  expect(watcherEvent).to.containSubset({
    transaction: watcherRes as any,
    appInstanceId: app.identityHash,
  });
  // verify stored challenge
  const challenge = await store.getAppChallenge(app.identityHash);
  verifyCancelChallenge(app, challengeUpdated as any, challenge!);
};
