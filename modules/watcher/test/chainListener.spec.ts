import { expect } from "chai";
import { Contract, Wallet } from "ethers";
import {
  JsonRpcProvider,
  ChallengeUpdatedContractEvent,
  ChallengeStatus,
  NetworkContext,
  StateProgressedContractEvent,
} from "@connext/types";
import { stateToHash, setupContext, AppWithCounterClass, ActionType } from "./utils";
import { nullLogger, toBN, ChannelSigner, computeAppChallengeHash } from "@connext/utils";
import { ChainListener } from "../src";
import { beforeEach } from "mocha";
import { Zero, One } from "ethers/constants";

describe("ChainListener", () => {
  let challengeRegistry: Contract;
  let provider: JsonRpcProvider;
  let chainListener: ChainListener;
  let setAndProgressState: any;
  let appInstance: AppWithCounterClass;
  let channelResponder: Wallet;

  beforeEach(async () => {
    const context = await setupContext();
    challengeRegistry = context["challengeRegistry"];
    provider = context["provider"];
    setAndProgressState = context["setAndProgressState"];
    appInstance = context["appInstance"];
    channelResponder = context["channelResponder"];

    chainListener = new ChainListener(
      provider,
      { ChallengeRegistry: challengeRegistry.address } as NetworkContext,
      nullLogger,
    );
  });

  it("should parse ChallengeUpdated + StateProgressed events properly when enabled", async () => {
    await chainListener.enable();

    const versionNumber = toBN(3);
    const state = {
      counter: Zero,
    };
    const action = {
      actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
      increment: toBN(1),
    };
    const timeout = Zero;

    let statesUpdated: ChallengeUpdatedContractEvent[] = [];
    // trigger `ChallengeUpdated` event
    const [states, progressed, tx] = await Promise.all([
      new Promise(async resolve => {
        chainListener.on("ChallengeUpdated", async (data: ChallengeUpdatedContractEvent) => {
          statesUpdated.push(data);
          if (statesUpdated.length >= 2) {
            return resolve(
              statesUpdated.sort((a, b) => a.versionNumber.toNumber() - b.versionNumber.toNumber()),
            );
          }
        });
      }),
      new Promise(async resolve => {
        chainListener.once("StateProgressed", async (data: StateProgressedContractEvent) => {
          return resolve(data);
        });
      }),
      new Promise(async (resolve, reject) => {
        try {
          const tx = await setAndProgressState(versionNumber, state, action);
          await tx.wait();
          return resolve(tx);
        } catch (e) {
          return reject(e.stack || e.message);
        }
      }),
    ]);
    ////// verification
    // tx
    expect(tx).to.be.ok;
    // first state from "setState"
    expect((states as ChallengeUpdatedContractEvent[])[0]).to.containSubset({
      identityHash: appInstance.identityHash,
      status: ChallengeStatus.IN_DISPUTE,
      appStateHash: stateToHash(AppWithCounterClass.encodeState(state)),
      versionNumber,
      finalizesAt: timeout.add(await provider.getBlockNumber()),
    });
    // final state from "applyAction"
    const finalState = AppWithCounterClass.encodeState({
      counter: state.counter.add(action.increment),
    });
    expect((states as ChallengeUpdatedContractEvent[])[1]).to.containSubset({
      identityHash: appInstance.identityHash,
      status: ChallengeStatus.IN_ONCHAIN_PROGRESSION,
      appStateHash: stateToHash(finalState),
      versionNumber: versionNumber.add(1),
      finalizesAt: appInstance.defaultTimeout.add(await provider.getBlockNumber()),
    });
    // applied action
    const turnTaker = new ChannelSigner(channelResponder.privateKey);
    const digest = computeAppChallengeHash(
      appInstance.identityHash,
      stateToHash(finalState),
      versionNumber.add(One),
      Zero,
    );
    expect(progressed).to.containSubset({
      identityHash: appInstance.identityHash,
      action: AppWithCounterClass.encodeAction(action),
      versionNumber: versionNumber.add(One),
      turnTaker: turnTaker.address,
      signature: await turnTaker.signMessage(digest),
    });
  });
});
