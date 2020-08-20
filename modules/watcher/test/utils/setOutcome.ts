import {
  IStoreService,
  WatcherEvents,
  ChallengeStatus,
  ChallengeOutcomeSetEventData,
} from "@connext/types";
import { expect, mineBlock, TestNetworkContext } from ".";
import { Watcher } from "../../src";
import { toBN } from "@connext/utils";

export const waitForSetOutcome = async (
  appIds: string[],
  watcher: Watcher,
  store: IStoreService,
  networkContext: TestNetworkContext,
) => {
  const stored = await Promise.all(appIds.map((id) => store.getAppChallenge(id)));

  // Wait for the outcome to be set
  const matchesId = (data: any, id: string) => {
    const emitted = data["identityHash"] || data["appInstanceId"];
    return emitted && emitted === id;
  };
  const EVENT_TIMEOUT = 10_000;

  // Get all outcome set and challenge updated events
  const events = ((await Promise.all([
    ...appIds.map((id) =>
      watcher.waitFor(WatcherEvents.CHALLENGE_OUTCOME_SET_EVENT, EVENT_TIMEOUT, (data) =>
        matchesId(data, id),
      ),
    ),
    ...appIds.map((id) =>
      watcher.waitFor(WatcherEvents.CHALLENGE_UPDATED_EVENT, EVENT_TIMEOUT, (data) =>
        matchesId(data, id),
      ),
    ),
    mineBlock(networkContext.provider),
  ])) as unknown) as any;
  const outcomeSet = events.filter((e) => e && e["transaction"]);
  const challengeUpdated = events.filter((e) => e && e["appStateHash"]);
  for (const id of appIds) {
    // Verify stored challenge
    const existing = stored.find((c) => c && c.identityHash === id);
    expect(existing).to.be.ok;
    const expected = {
      ...existing!,
      status: ChallengeStatus.OUTCOME_SET,
    };
    const updated = await store.getAppChallenge(id);
    expect(updated).to.containSubset(expected);

    // Verify stored events
    const events = await store.getChallengeUpdatedEvents(id);
    const event = events.find(
      (e) =>
        toBN(e.versionNumber).eq(toBN(expected.versionNumber)) &&
        e.status === ChallengeStatus.OUTCOME_SET,
    );
    expect(event).to.be.ok;
    expect(event).to.containSubset(expected);

    // Verify emitted events
    const outcomeSetEvt = (outcomeSet.find(
      (x: any) => x.appInstanceId === id,
    ) as unknown) as ChallengeOutcomeSetEventData;
    expect(outcomeSetEvt.transaction).to.be.ok;
    expect(outcomeSetEvt.multisigAddress).to.be.ok;
    expect(outcomeSetEvt.appInstanceId).to.be.eq(id);

    const challengeUpdatedEvt = challengeUpdated.find((x) => x.identityHash === id);
    expect(challengeUpdatedEvt).to.containSubset(expected);
  }
};
