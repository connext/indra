import {
  IWatcherStoreService,
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
  store: IWatcherStoreService,
  networkContext: TestNetworkContext,
) => {
  // Get stored challenges before setting outcome
  const stored = await (await Promise.all(appIds.map((id) => store.getAppChallenge(id)))).filter(
    (x) => !!x,
  );

  // Wait for the outcome to be set
  const matchesId = (data: any, id: string) => {
    const emitted = data["identityHash"] || data["appInstanceId"];
    return emitted && emitted === id;
  };
  const EVENT_TIMEOUT = 10_000;

  // Get all outcome set and challenge updated events
  const [outcomeSet, challengeUpdated] = await Promise.all([
    Promise.all([
      new Promise((_, reject) =>
        watcher.once(WatcherEvents.ChallengeOutcomeFailedEvent, async () =>
          reject("Failed to set outcome"),
        ),
      ),
      ...appIds.map((id) =>
        watcher.waitFor(WatcherEvents.ChallengeOutcomeSetEvent, EVENT_TIMEOUT, (data) =>
          matchesId(data, id),
        ),
      ),
    ]),
    Promise.all(
      appIds.map((id) =>
        watcher.waitFor(WatcherEvents.ChallengeUpdatedEvent, EVENT_TIMEOUT, (data) =>
          matchesId(data, id),
        ),
      ),
    ),
    mineBlock(networkContext.provider),
  ]);

  for (const id of appIds) {
    // Verify stored challenge
    const expected = {
      ...stored.find((challenge) => challenge?.identityHash === id)!,
      status: ChallengeStatus.OUTCOME_SET,
    };
    const updated = await store.getAppChallenge(id);
    expect(updated).to.containSubset(expected);

    // Verify stored events
    const events = await store.getChallengeUpdatedEvents(id);
    const event = events.find(
      (e) =>
        e.versionNumber.eq(toBN(expected.versionNumber)) &&
        e.status === ChallengeStatus.OUTCOME_SET,
    );
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
