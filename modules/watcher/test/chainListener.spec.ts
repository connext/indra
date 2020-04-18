import { expect } from "chai";
import { Contract } from "ethers";
import { JsonRpcProvider, ChallengeUpdatedContractEvent, ChallengeStatus, NetworkContext } from "@connext/types";
import { randomState, stateToHash, setupContext } from "./utils";
import { nullLogger, toBN, createRandom32ByteHexString } from "@connext/utils";
import { ChainListener } from "../src";
import { beforeEach } from "mocha";

describe("ChainListener", () => {

  let challengeRegistry: Contract;
  let provider: JsonRpcProvider;
  let chainListener: ChainListener;
  let setState: any;

  beforeEach(async () => {
    const context = await setupContext();
    challengeRegistry = context["challengeRegistry"];
    provider = context["provider"];
    setState = context["setState"];

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
    const hash = createRandom32ByteHexString();
    const timeout = toBN(4);

    // trigger `ChallengeUpdated` event
    const [emitted, tx] = await Promise.all([
      new Promise(async resolve => {
        chainListener.once("ChallengeUpdated", async (data: ChallengeUpdatedContractEvent) => {
          console.log(`caught challenge updated event with data`, data);
          return resolve(data);
        });
      }),
      new Promise(async resolve => {
        console.log(`calling set state`);
        const res = await setState(versionNumber, timeout, state);
        console.log(`called:`, res);
        return resolve(res);
      }),
    ]);
    console.log(`awaited all promises`);
    expect(tx).to.be.ok;
    expect(emitted).to.containSubset({
      identityHash: hash,
      status: ChallengeStatus.IN_DISPUTE,
      appStateHash: stateToHash(state),
      versionNumber,
      finalizesAt: timeout.add(await provider.getBlockNumber()),
    });
  });
});
