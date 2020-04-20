import { expect } from "chai";
import { Contract } from "ethers";
import { JsonRpcProvider, ChallengeUpdatedContractEvent, ChallengeStatus, NetworkContext } from "@connext/types";
import { randomState, stateToHash, setupContext } from "./utils";
import { nullLogger, toBN } from "@connext/utils";
import { ChainListener } from "../src";
import { beforeEach } from "mocha";

describe("ChainListener", () => {

  let challengeRegistry: Contract;
  let provider: JsonRpcProvider;
  let chainListener: ChainListener;
  let setState: any;
  let appInstance: any;

  beforeEach(async () => {
    const context = await setupContext();
    challengeRegistry = context["challengeRegistry"];
    provider = context["provider"];
    setState = context["setState"];
    appInstance = context["appInstance"];

    chainListener = new ChainListener(
      provider,
      { ChallengeRegistry: challengeRegistry.address } as NetworkContext,
      nullLogger,
    );
  });

  it("should parse ChallengeUpdated events properly when enabled", async () => {
    await chainListener.enable();

    const versionNumber = toBN(3);
    const state = randomState();
    const timeout = toBN(4);

    // trigger `ChallengeUpdated` event
    const [emitted, tx] = await Promise.all([
      new Promise(async resolve => {
        chainListener.once("ChallengeUpdated", async (data: ChallengeUpdatedContractEvent) => {
          return resolve(data);
        });
      }),
      new Promise(async resolve => {
        const tx = await setState(versionNumber, timeout, state);
        await tx.wait();
        return resolve(tx);
      }),
    ]);
    expect(tx).to.be.ok;
    expect(emitted).to.containSubset({
      identityHash: appInstance.identityHash,
      status: ChallengeStatus.IN_DISPUTE,
      appStateHash: stateToHash(state),
      versionNumber,
      finalizesAt: timeout.add(await provider.getBlockNumber()),
    });
  });
});
