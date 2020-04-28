import { ChallengeRegistry, ProxyFactory, MinimumViableMultisig, ERC20 } from "@connext/contracts";
import {
  JsonRpcProvider,
  BigNumber,
  CONVENTION_FOR_ETH_ASSET_ID,
  CoinTransfer,
} from "@connext/types";
import {
  computeAppChallengeHash,
  ChannelSigner,
  toBN,
  getRandomChannelSigner,
} from "@connext/utils";
import { Wallet, Contract } from "ethers";
import { One, Zero } from "ethers/constants";
import { keccak256, Interface } from "ethers/utils";

import {
  AppWithCounterClass,
  AppWithCounterState,
  AppWithCounterAction,
  ActionType,
} from "./appWithCounter";
import { ConnextStore } from "@connext/store";
import { MiniFreeBalance } from "./miniFreeBalance";
import { deployTestArtifactsToChain } from "./contracts";
import { CREATE_PROXY_AND_SETUP_GAS } from "./utils";
import { expect } from "./assertions";

export type TokenIndexedBalance = { [tokenAddress: string]: CoinTransfer[] };

/////////////////////////////
// Context

// setup constants
const ethProvider = process.env.ETHPROVIDER_URL;
const provider = new JsonRpcProvider(ethProvider);

const wallet = Wallet.fromMnemonic(process.env.SUGAR_DADDY!).connect(provider);
const signers = [getRandomChannelSigner(ethProvider), getRandomChannelSigner(ethProvider)];

const appBalances: TokenIndexedBalance = {
  [CONVENTION_FOR_ETH_ASSET_ID]: [
    { to: signers[0].address, amount: One },
    { to: signers[1].address, amount: Zero },
  ],
};

export const setupContext = async (activeAppBalances: TokenIndexedBalance[] = [appBalances]) => {
  // deploy contracts
  const networkContext = await deployTestArtifactsToChain(wallet);
  const challengeRegistry = new Contract(
    networkContext.ChallengeRegistry,
    ChallengeRegistry.abi,
    wallet,
  );
  // deploy  multisig
  const proxyFactory = new Contract(networkContext.ProxyFactory, ProxyFactory.abi, wallet);
  const multisigAddress: string = await new Promise(async (resolve) => {
    proxyFactory.once("ProxyCreation", async (proxyAddress: string) => resolve(proxyAddress));
    await proxyFactory.functions.createProxyWithNonce(
      networkContext.MinimumViableMultisig,
      new Interface(MinimumViableMultisig.abi).functions.setup.encode([
        [signers[0].address, signers[1].address],
      ]),
      0,
      { gasLimit: CREATE_PROXY_AND_SETUP_GAS },
    );
  });
  // if it is successfully deployed, should be able to call amount withdraw
  const withdrawn = await new Contract(
    multisigAddress,
    MinimumViableMultisig.abi,
    wallet,
  ).functions.totalAmountWithdrawn(CONVENTION_FOR_ETH_ASSET_ID);
  expect(withdrawn).to.be.eq(Zero);

  // create objects
  const activeApps = activeAppBalances.map((balance, idx) => {
    return new AppWithCounterClass(
      signers,
      multisigAddress,
      networkContext.AppWithAction,
      Zero, // default timeout
      toBN(idx).add(2), // channel nonce = idx + free-bal + 1
      balance,
    );
  });

  const [freeBalance, channel] = MiniFreeBalance.channelFactory(
    signers,
    multisigAddress,
    networkContext,
    activeApps,
    {
      [CONVENTION_FOR_ETH_ASSET_ID]: [
        { to: signers[0].address, amount: Zero },
        { to: signers[1].address, amount: Zero },
      ],
      [networkContext.Token]: [
        { to: signers[0].address, amount: Zero },
        { to: signers[1].address, amount: Zero },
      ],
    },
  );

  // fund multisig with eth
  // gather all balance objects to reduce
  const appBalances: { [assetId: string]: CoinTransfer[] }[] = activeApps
    .map((app) => app.tokenIndexedBalances)
    .concat(freeBalance.balances);

  let channelBalances: { [assetId: string]: BigNumber } = {};
  Object.keys(freeBalance.balances).forEach((assetId) => {
    let assetTotal = Zero;
    appBalances.forEach((tokenIndexed) => {
      const appTotal = (tokenIndexed[assetId] || [{ to: "", amount: Zero }]).reduce(
        (prev, curr) => {
          return { to: "", amount: curr.amount.add(prev.amount) };
        },
      ).amount;
      assetTotal = assetTotal.add(appTotal);
    });
    channelBalances[assetId] = assetTotal;
  });

  const token = new Contract(networkContext.Token, ERC20.abi, wallet);
  await wallet.sendTransaction({
    to: multisigAddress,
    value: channelBalances[CONVENTION_FOR_ETH_ASSET_ID],
  });
  await token.transfer(multisigAddress, channelBalances[networkContext.Token]);
  expect(await provider.getBalance(multisigAddress)).to.be.eq(
    channelBalances[CONVENTION_FOR_ETH_ASSET_ID],
  );
  expect(await token.functions.balanceOf(multisigAddress)).to.be.eq(
    channelBalances[networkContext.Token],
  );

  /////////////////////////////////////////
  // contract helper function -- used for listener tests
  // disputes activeApps[0] by default
  const setAndProgressState = async (
    versionNumber: BigNumber,
    state: AppWithCounterState,
    action: AppWithCounterAction,
    timeout: BigNumber = Zero,
    turnTaker: ChannelSigner = signers[1],
  ) => {
    const stateHash = keccak256(AppWithCounterClass.encodeState(state));
    const stateDigest = computeAppChallengeHash(
      activeApps[0].identityHash,
      stateHash,
      versionNumber,
      timeout,
    );
    const resultingState: AppWithCounterState = {
      counter:
        action.actionType === ActionType.ACCEPT_INCREMENT
          ? state.counter
          : state.counter.add(action.increment),
    };
    const timeout2 = Zero;
    const resultingStateHash = keccak256(AppWithCounterClass.encodeState(resultingState));
    const resultingStateDigest = computeAppChallengeHash(
      activeApps[0].identityHash,
      resultingStateHash,
      One.add(versionNumber),
      timeout2,
    );

    const signatures = [
      await signers[0].signMessage(stateDigest),
      await signers[1].signMessage(stateDigest),
    ];

    const req1 = {
      versionNumber,
      appStateHash: stateHash,
      timeout,
      signatures,
    };
    const req2 = {
      versionNumber: One.add(versionNumber),
      appStateHash: resultingStateHash,
      timeout: timeout2,
      signatures: [await turnTaker.signMessage(resultingStateDigest)],
    };
    return challengeRegistry.functions.setAndProgressState(
      activeApps[0].appIdentity,
      req1,
      req2,
      AppWithCounterClass.encodeState(state),
      AppWithCounterClass.encodeAction(action),
    );
  };

  // store helper function
  const loadStore = async (store: ConnextStore) => {
    // create the channel
    await store.createStateChannel(
      channel,
      await freeBalance.getSetup(),
      await freeBalance.getInitialSetState(),
    );

    // add the app + all commitments to the store
    for (const app of activeApps) {
      await store.createAppProposal(
        multisigAddress,
        app.getProposal(),
        app.toJson().appSeqNo,
        await app.getInitialSetState(networkContext.ChallengeRegistry),
      );

      // no need to create intermediate free balance state, since
      // it will always be overwritten with most recent in store

      await store.createAppInstance(
        multisigAddress,
        app.toJson(),
        freeBalance.toJson(),
        await freeBalance.getSetState(),
        await app.getConditional(freeBalance.identityHash, networkContext),
      );

      await store.updateAppInstance(
        multisigAddress,
        app.toJson(),
        await app.getCurrentSetState(networkContext.ChallengeRegistry),
      );
    }
  };

  return {
    ethProvider,
    challengeRegistry,
    provider,
    wallet,
    signers,
    multisigAddress,
    activeApps,
    freeBalance,
    networkContext,
    channelBalances,
    setAndProgressState,
    loadStore,
  };
};
