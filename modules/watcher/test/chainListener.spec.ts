import { Contract, constants } from "ethers";
import {
  JsonRpcProvider,
  ChallengeUpdatedEventPayload,
  ChallengeStatus,
  NetworkContext,
  StateProgressedEventPayload,
} from "@connext/types";
import { ChannelSigner, ColorfulLogger, computeAppChallengeHash, toBN } from "@connext/utils";
import { beforeEach } from "mocha";

import { stateToHash, setupContext, AppWithCounterClass, ActionType, expect } from "./utils";

import { ChainListener } from "../src";

const { Zero, One } = constants;

describe("ChainListener", () => {
  let challengeRegistry: Contract;
  let provider: JsonRpcProvider;
  let chainListener: ChainListener;
  let setAndProgressState: any;
  let appInstance: AppWithCounterClass;
  let signers: ChannelSigner[];

  const logLevel = parseInt(process.env.LOG_LEVEL || "0");
  const log = new ColorfulLogger("TestChainListener", logLevel, true, "T");

  const action = {
    actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
    increment: toBN(1),
  };
  const timeout = One;

  const verifySetAndProgressEvents = async (
    states: ChallengeUpdatedEventPayload[],
    progressed: StateProgressedEventPayload,
  ) => {
    // first state from "setState"
    expect((states as ChallengeUpdatedEventPayload[])[0]).to.containSubset({
      identityHash: appInstance.identityHash,
      status: ChallengeStatus.IN_DISPUTE,
      appStateHash: stateToHash(AppWithCounterClass.encodeState(appInstance.latestState)),
      versionNumber: appInstance.latestVersionNumber,
    });
    // final state from "applyAction"
    const finalState = AppWithCounterClass.encodeState({
      counter: appInstance.latestState.counter.add(action.increment),
    });
    expect((states as ChallengeUpdatedEventPayload[])[1]).to.containSubset({
      identityHash: appInstance.identityHash,
      status: ChallengeStatus.IN_ONCHAIN_PROGRESSION,
      appStateHash: stateToHash(finalState),
      versionNumber: appInstance.latestVersionNumber.add(1),
    });
    // applied action
    const turnTaker = signers[0];
    const digest = computeAppChallengeHash(
      appInstance.identityHash,
      stateToHash(finalState),
      appInstance.latestVersionNumber.add(One),
      Zero,
    );
    expect(progressed).to.containSubset({
      identityHash: appInstance.identityHash,
      action: AppWithCounterClass.encodeAction(action),
      versionNumber: appInstance.latestVersionNumber.add(One),
      turnTaker: turnTaker.address,
      signature: await turnTaker.signMessage(digest),
    });
  };

  beforeEach(async () => {
    const context = await setupContext(false, [{ defaultTimeout: timeout }]);
    challengeRegistry = context["challengeRegistry"];
    provider = context["provider"];
    setAndProgressState = context["setAndProgressState"];
    appInstance = context["activeApps"][0];
    signers = context["signers"];

    chainListener = new ChainListener(
      provider,
      { ChallengeRegistry: challengeRegistry.address } as NetworkContext,
      new ColorfulLogger("Test", logLevel, true, " "),
    );
  });

  afterEach(() => {
    chainListener.removeAllListeners();
  });

  it("should parse ChallengeUpdated + StateProgressed events properly when enabled", async () => {
    await chainListener.enable();

    const statesUpdated: ChallengeUpdatedEventPayload[] = [];
    // trigger `ChallengeUpdated` event
    const [states, progressed, tx] = await Promise.all([
      new Promise(async (resolve) => {
        chainListener.on("ChallengeUpdated", async (data: ChallengeUpdatedEventPayload) => {
          statesUpdated.push(data);
          if (statesUpdated.length >= 2) {
            return resolve(
              statesUpdated.sort((a, b) => a.versionNumber.toNumber() - b.versionNumber.toNumber()),
            );
          }
        });
      }),
      new Promise(async (resolve) => {
        chainListener.once("StateProgressed", async (data: StateProgressedEventPayload) => {
          return resolve(data);
        });
      }),
      setAndProgressState(action),
    ]);
    ////// verification
    // tx
    expect(tx).to.be.ok;
    // first state from "setState"
    await verifySetAndProgressEvents(
      states as ChallengeUpdatedEventPayload[],
      progressed as StateProgressedEventPayload,
    );
  });

  it("should not parse any events if disabled", async () => {
    await chainListener.disable();

    const action = {
      actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
      increment: toBN(1),
    };

    // track any emitted events
    let emitted = 0;
    chainListener.on("ChallengeUpdated", () => {
      emitted += 1;
      return Promise.resolve();
    });
    chainListener.on("StateProgressed", () => {
      emitted += 1;
      return Promise.resolve();
    });

    // submit transaction
    const tx = await setAndProgressState(action);
    expect(tx).to.be.ok;
    expect(emitted).to.be.eq(0);
  });

  it("should be able to parse past logs", async () => {
    await chainListener.disable();

    // submit transaction
    const startingBlock = await provider.getBlockNumber();
    log.debug(`parsing past logs staring from block: ${startingBlock}`);
    const tx = await setAndProgressState(action);
    expect(tx).to.be.ok;

    // wait for block number to increase
    await new Promise((resolve) =>
      provider.on("block", (block: number) => {
        if (startingBlock < block) {
          return resolve();
        }
      }),
    );
    expect(startingBlock).to.be.lessThan(await provider.getBlockNumber());

    // parse logs
    const statesUpdated: ChallengeUpdatedEventPayload[] = [];
    const [states, progressed] = await Promise.all([
      new Promise(async (resolve) => {
        chainListener.on("ChallengeUpdated", async (data: ChallengeUpdatedEventPayload) => {
          statesUpdated.push(data);
          if (statesUpdated.length >= 2) {
            return resolve(
              statesUpdated.sort((a, b) => a.versionNumber.toNumber() - b.versionNumber.toNumber()),
            );
          }
        });
      }),
      new Promise(async (resolve) => {
        chainListener.once("StateProgressed", async (data: StateProgressedEventPayload) => {
          return resolve(data);
        });
      }),
      chainListener.parseLogsFrom(startingBlock),
    ]);

    // verify events
    // first state from "setState"
    await verifySetAndProgressEvents(
      states as ChallengeUpdatedEventPayload[],
      progressed as StateProgressedEventPayload,
    );
  });
});
