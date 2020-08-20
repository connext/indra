import { AppWithCounterClass } from "./appWithCounter";
import { Watcher } from "../../src";
import { IStoreService, WatcherEvents } from "@connext/types";
import { expect, nullify, verifyCancelChallenge } from ".";

export const cancelDispute = async (
  app: AppWithCounterClass,
  watcher: Watcher,
  store: IStoreService,
  failsWith: string | undefined = undefined,
) => {
  const existing = await store.getAppChallenge(app.identityHash);
  expect(existing).to.be.ok;
  const req = await app.getCancelDisputeRequest(existing!.versionNumber);
  const watcherPromise = failsWith
    ? watcher.waitFor(WatcherEvents.CHALLENGE_CANCELLATION_FAILED_EVENT, 10_000)
    : watcher.waitFor(WatcherEvents.CHALLENGE_CANCELLED_EVENT, 10_000);

  const contractPromise = failsWith
    ? Promise.resolve()
    : watcher.waitFor(
        WatcherEvents.CHALLENGE_UPDATED_EVENT,
        10_000,
        (data) => data.identityHash === app.identityHash,
      );
  const [watcherEvent, challengeUpdated, watcherRes] = await Promise.all([
    watcherPromise,
    contractPromise,
    new Promise(async (resolve, reject) => {
      try {
        const ret = await watcher.cancel(app.identityHash, req);
        const receipt = await ret.wait();
        resolve(receipt);
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
      transaction: watcherRes,
      appInstanceId: app.identityHash,
    });
    verifyCancelChallenge(app, challengeUpdated as any, challenge!);
  }
};
