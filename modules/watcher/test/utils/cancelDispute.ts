import { AppWithCounterClass } from "./appWithCounter";
import { Watcher } from "../../src";
import {
  IWatcherStoreService,
  WatcherEvents,
  ChallengeCancellationFailedEventData,
  ChallengeCancelledEventData,
  ChallengeUpdatedEventData,
} from "@connext/types";
import { expect, nullify, verifyCancelChallenge } from ".";

export const cancelDispute = async (
  app: AppWithCounterClass,
  watcher: Watcher,
  store: IWatcherStoreService,
  failsWith: string | undefined = undefined,
) => {
  const existing = await store.getAppChallenge(app.identityHash);
  expect(existing).to.be.ok;
  const req = await app.getCancelDisputeRequest(existing!.versionNumber);
  const [watcherEvent, challengeUpdated, watcherRes] = await Promise.all([
    new Promise((resolve) => {
      watcher.once(
        WatcherEvents.ChallengeCancellationFailedEvent,
        async (data: ChallengeCancellationFailedEventData) => resolve(data),
      );
      watcher.once(
        WatcherEvents.ChallengeCancelledEvent,
        async (data: ChallengeCancelledEventData) => resolve(data),
      );
    }),
    new Promise((resolve) => {
      if (failsWith) {
        resolve();
      }
      watcher.on(WatcherEvents.ChallengeUpdatedEvent, async (data: ChallengeUpdatedEventData) => {
        if (data.identityHash === app.identityHash) {
          resolve(data);
        }
      });
    }),
    new Promise(async (resolve, reject) => {
      try {
        const ret = await watcher.cancel(app.identityHash, req);
        resolve(ret);
      } catch (e) {
        if (failsWith) {
          resolve(e.message);
        } else {
          reject(e.message);
        }
      }
    }),
  ]);
  // verify watcher event + stored challenges
  const challenge = await store.getAppChallenge(app.identityHash);
  if (failsWith) {
    expect(watcherEvent).to.containSubset({
      appInstanceId: app.identityHash,
      challenge: existing,
      params: { app: JSON.parse(JSON.stringify(app.toJson()), nullify), req },
    });
    expect((watcherEvent as any).error.includes(failsWith)).to.be.true;
    expect((watcherEvent as any).multisigAddress).to.be.ok;

    expect(challenge).to.containSubset(existing);
  } else {
    expect(watcherEvent).to.containSubset({
      transaction: watcherRes as any,
      appInstanceId: app.identityHash,
    });
    verifyCancelChallenge(app, challengeUpdated as any, challenge!);
  }
};
