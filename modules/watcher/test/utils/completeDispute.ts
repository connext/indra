import { Watcher } from "../../src";
import {
  IWatcherStoreService,
  WatcherEvents,
  ChallengeCompletedEventData,
  ChallengeCompletionFailedEventData,
} from "@connext/types";
import { TestNetworkContext, expect } from ".";
import { mineBlock } from "./contracts";

export const waitForDisputeCompletion = async (
  appIds: string[],
  watcher: Watcher,
  store: IWatcherStoreService,
  networkContext: TestNetworkContext,
) => {
  // Get stored challenges before setting outcome
  const stored = await (await Promise.all(appIds.map((id) => store.getAppChallenge(id)))).filter(
    (x) => !!x,
  );

  // Wait for the completed events
  const matchesId = (data: any, id: string) => {
    const emitted = data["identityHash"] || data["appInstanceId"];
    return emitted && emitted === id;
  };
  const [completed] = await Promise.all([
    new Promise(async (resolve, reject) => {
      watcher.once(
        WatcherEvents.ChallengeCompletionFailedEvent,
        async (data: ChallengeCompletionFailedEventData) => reject(data),
      );
      const evts = await Promise.all(
        appIds.map((id) =>
          watcher.waitFor(WatcherEvents.ChallengeCompletedEvent, 10_000, (data) =>
            matchesId(data, id),
          ),
        ),
      );
      return resolve(evts);
    }),
    mineBlock(networkContext.provider),
  ]);

  for (const id of appIds) {
    // Verify stored challenge
    const expected = stored.find((c) => c?.identityHash === id);
    const challenge = await store.getAppChallenge(id);
    expect(challenge).to.containSubset(expected);

    // Verify emitted events
    const evt = (completed as ChallengeCompletedEventData[]).find((c) => c.appInstanceId === id);
    expect(evt).to.be.ok;
    expect(evt!.appInstanceId).to.be.eq(id);
    expect(evt!.multisigAddress).to.be.ok;
    expect(evt!.transaction).to.be.ok;
  }
};
