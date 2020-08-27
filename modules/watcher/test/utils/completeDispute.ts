import { Watcher } from "../../src";
import {
  IStoreService,
  WatcherEvents,
  ChallengeCompletedEventData,
  StoredAppChallengeStatus,
} from "@connext/types";
import { TestNetworkContext, expect } from ".";
import { mineBlock } from "./contracts";

export const waitForDisputeCompletion = async (
  appIds: string[],
  watcher: Watcher,
  store: IStoreService,
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
    Promise.all(
      appIds.map((id) =>
        watcher.waitFor(WatcherEvents.CHALLENGE_COMPLETED_EVENT, 10_000, (data) =>
          matchesId(data, id),
        ),
      ),
    ),
    mineBlock(networkContext.provider),
  ]);

  for (const id of appIds) {
    // Verify stored challenge
    const expected = stored.find((c) => c?.identityHash === id);
    const challenge = await store.getAppChallenge(id);
    expect(challenge).to.containSubset({
      ...expected,
      status: StoredAppChallengeStatus.CONDITIONAL_SENT,
    });

    // Verify emitted events
    const evt = (completed as ChallengeCompletedEventData[]).find((c) => c.appInstanceId === id);
    expect(evt).to.be.ok;
    expect(evt!.appInstanceId).to.be.eq(id);
    expect(evt!.multisigAddress).to.be.ok;
    expect(evt!.transaction).to.be.ok;
  }
};
