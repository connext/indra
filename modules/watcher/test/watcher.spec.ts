import { ConnextStore } from "@connext/store";
import {
  JsonRpcProvider,
  StoreTypes,
  CONVENTION_FOR_ETH_ASSET_ID,
  BigNumber,
} from "@connext/types";
import { Wallet, Contract } from "ethers";

import {
  setupContext,
  expect,
  NetworkContextForTestSuite,
  MiniFreeBalance,
  AppWithCounterClass,
} from "./utils";

import { Watcher } from "../src";
import { ChannelSigner, getRandomAddress, ColorfulLogger } from "@connext/utils";
import { MinimumViableMultisig } from "@connext/contracts";
import { Zero } from "ethers/constants";
import { initiateDispute } from "./utils/initiateDispute";

describe("Watcher.init", () => {
  let provider: JsonRpcProvider;

  beforeEach(async () => {
    const context = await setupContext();
    provider = context["provider"];
  });

  it("should be able to instantiate with a private key", async () => {
    const guard = await Watcher.init({
      signer: Wallet.createRandom().privateKey,
      provider: provider.connection.url,
      store: new ConnextStore(StoreTypes.Memory),
      context: { ChallengeRegistry: getRandomAddress() } as any,
    });
    expect(guard).to.be.instanceOf(Watcher);
  });

  it("should be able to instantiate with a ChannelSigner", async () => {
    const guard = await Watcher.init({
      signer: new ChannelSigner(Wallet.createRandom().privateKey, provider.connection.url),
      provider: provider,
      store: new ConnextStore(StoreTypes.Memory),
      context: { ChallengeRegistry: getRandomAddress() } as any,
    });
    expect(guard).to.be.instanceOf(Watcher);
  });
});

describe("Watcher.initiate", () => {
  let provider: JsonRpcProvider;
  let store: ConnextStore;
  let multisigAddress: string;
  let channelBalances: { [k: string]: BigNumber };
  let freeBalance: MiniFreeBalance;
  let app: AppWithCounterClass;

  let networkContext: NetworkContextForTestSuite;

  let watcher: Watcher;
  let wallet: Wallet;

  beforeEach(async () => {
    const context = await setupContext();

    // get all values needed from context
    provider = context["provider"];
    wallet = context["wallet"];
    multisigAddress = context["multisigAddress"];
    const activeApps = context["activeApps"];
    app = activeApps[0];
    freeBalance = context["freeBalance"];
    channelBalances = context["channelBalances"];
    networkContext = context["networkContext"];
    const loadStore = context["loadStore"];

    // create + load store
    store = new ConnextStore(StoreTypes.Memory);
    await loadStore(store);

    watcher = await Watcher.init({
      context: networkContext,
      provider,
      store,
      signer: context["wallet"].privateKey,
      logger: new ColorfulLogger("Watcher", 5, true, "A"),
    });
    expect(await store.getLatestProcessedBlock()).to.be.eq(await provider.getBlockNumber());
  });

  afterEach(async () => {
    await watcher.disable();
    await store.clear();
  });

  it.only("should be able to initiate + complete a dispute with a particular app instance using set state", async () => {
    const { outcomeSet, verifyOutcomeSet,  } = await initiateDispute(
      app,
      freeBalance,
      watcher,
      store,
      networkContext,
    );

    await verifyOutcomeSet(await outcomeSet);
    // await verifyCompleted(await completed);

    // verify final balances
    const withdrawn = await new Contract(
      multisigAddress,
      MinimumViableMultisig.abi,
      wallet,
    ).functions.totalAmountWithdrawn(CONVENTION_FOR_ETH_ASSET_ID);
    expect(withdrawn).to.be.eq(channelBalances[CONVENTION_FOR_ETH_ASSET_ID]);
    expect(await provider.getBalance(multisigAddress)).to.be.eq(Zero);
    expect((await provider.getBalance(freeBalance.participants[0])).toString()).to.be.eq(
      channelBalances[CONVENTION_FOR_ETH_ASSET_ID],
    );
    expect((await provider.getBalance(freeBalance.participants[1])).toString()).to.be.eq(Zero);
  });
});
