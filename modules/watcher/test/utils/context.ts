import {
  ChallengeRegistry,
  ProxyFactory,
  MinimumViableMultisig,
  ERC20,
  SetStateCommitment,
} from "@connext/contracts";
import {
  JsonRpcProvider,
  CONVENTION_FOR_ETH_ASSET_ID,
  CoinTransfer,
  SetStateCommitmentJSON,
  ChallengeEvents,
  ChallengeStatus,
  IStoreService,
} from "@connext/types";
import { toBN, getRandomChannelSigner } from "@connext/utils";
import { BigNumber, Wallet, Contract, constants, utils } from "ethers";

import { AppWithCounterClass, AppWithCounterAction, ActionType } from "./appWithCounter";
import { getMemoryStore } from "@connext/store";
import { MiniFreeBalance } from "./miniFreeBalance";
import { deployTestArtifactsToChain, mineBlock } from "./contracts";
import { CREATE_PROXY_AND_SETUP_GAS } from "./utils";
import { expect, verifyChallengeUpdatedEvent } from "./assertions";

const { One, Zero } = constants;
const { Interface } = utils;

export type TokenIndexedBalance = { [tokenAddress: string]: CoinTransfer[] };
export type CreatedAppInstanceOpts = {
  balances: TokenIndexedBalance;
  defaultTimeout: BigNumber;
};

const MAX_FUNDING_RETRIES = 3;

/////////////////////////////
// Context

export const getAndInitStore = async (): Promise<IStoreService> => {
  const store = getMemoryStore();
  await store.init();
  await store.clear();
  return store;
};

export const setupContext = async (
  shouldLoadStore: boolean = true,
  // ensure one is actually created when no opts provided
  providedOpts?: Partial<CreatedAppInstanceOpts>[],
) => {
  // setup constants / defaults
  const ethProvider = process.env.ETHPROVIDER_URL;
  const provider = new JsonRpcProvider(ethProvider);

  const wallet = Wallet.fromMnemonic(process.env.SUGAR_DADDY!).connect(provider);
  const signers = [getRandomChannelSigner(ethProvider), getRandomChannelSigner(ethProvider)];
  const defaultAppOpts = {
    balances: {
      [CONVENTION_FOR_ETH_ASSET_ID]: [
        { to: signers[0].address, amount: One },
        { to: signers[1].address, amount: Zero },
      ],
    },
    defaultTimeout: Zero,
  };
  const store = await getAndInitStore();

  // deploy contracts
  await wallet.getTransactionCount();
  const networkContext = await deployTestArtifactsToChain(wallet);
  await wallet.getTransactionCount();
  const challengeRegistry = new Contract(
    networkContext.ChallengeRegistry,
    ChallengeRegistry.abi,
    wallet,
  );
  // deploy  multisig
  const proxyFactory = new Contract(networkContext.ProxyFactory, ProxyFactory.abi, wallet);
  const multisigAddress: string = await new Promise(async (resolve) => {
    proxyFactory.once("ProxyCreation", async (proxyAddress: string) => resolve(proxyAddress));
    await proxyFactory.createProxyWithNonce(
      networkContext.MinimumViableMultisig,
      new Interface(MinimumViableMultisig.abi).encodeFunctionData("setup", [
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
  ).totalAmountWithdrawn(CONVENTION_FOR_ETH_ASSET_ID);
  expect(withdrawn).to.be.eq(Zero);

  // create objects from provided overrides
  const activeApps = (providedOpts || [defaultAppOpts]).map((provided, idx) => {
    const { balances, defaultTimeout } = {
      ...defaultAppOpts,
      ...provided,
    };
    return new AppWithCounterClass(
      signers,
      multisigAddress,
      networkContext.AppWithAction,
      defaultTimeout, // default timeout
      toBN(idx).add(2), // channel nonce = idx + free-bal + 1
      balances,
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

  const channelBalances: { [assetId: string]: BigNumber } = {};
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
  for (let i = 0; i < MAX_FUNDING_RETRIES; i++) {
    try {
      const tx = await wallet.sendTransaction({
        to: multisigAddress,
        value: channelBalances[CONVENTION_FOR_ETH_ASSET_ID],
      });
      await tx.wait();
      expect(await provider.getBalance(multisigAddress)).to.be.eq(
        channelBalances[CONVENTION_FOR_ETH_ASSET_ID],
      );
      break;
    } catch (e) {
      console.log(`Failed to fund ETH attempt ${i}/${MAX_FUNDING_RETRIES}..`);
    }
  }
  for (let i = 0; i < MAX_FUNDING_RETRIES; i++) {
    try {
      const tx = await token.transfer(multisigAddress, channelBalances[networkContext.Token]);
      await tx.wait();
      expect(await token.balanceOf(multisigAddress)).to.be.eq(
        channelBalances[networkContext.Token],
      );
      break;
    } catch (e) {
      console.log(`Failed to fund tokens attempt ${i}/${MAX_FUNDING_RETRIES}..`);
    }
  }

  /////////////////////////////////////////
  // contract helper functions
  const setAndProgressState = async (
    action: AppWithCounterAction,
    app: AppWithCounterClass = activeApps[0],
  ) => {
    const setState0 = SetStateCommitment.fromJson(
      await app.getDoubleSignedSetState(networkContext.ChallengeRegistry),
    );
    app.latestAction = action;
    const setState1 = SetStateCommitment.fromJson(
      await app.getSingleSignedSetState(networkContext.ChallengeRegistry),
    );

    await wallet.getTransactionCount();
    const tx = await challengeRegistry.setAndProgressState(
      app.appIdentity,
      await setState0.getSignedAppChallengeUpdate(),
      await setState1.getSignedAppChallengeUpdate(),
      AppWithCounterClass.encodeState(app.latestState),
      AppWithCounterClass.encodeAction(app.latestAction),
    );
    return tx.wait();
  };

  const setState = async (
    app: AppWithCounterClass,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> => {
    const setState = SetStateCommitment.fromJson(commitment);
    const [event, tx] = await Promise.all([
      new Promise((resolve) => {
        challengeRegistry.on(
          ChallengeEvents.ChallengeUpdated,
          (
            identityHash: string,
            status: ChallengeStatus,
            appStateHash: string,
            versionNumber: BigNumber,
            finalizesAt: BigNumber,
          ) => {
            const converted = {
              identityHash,
              status,
              appStateHash,
              versionNumber: toBN(versionNumber),
              finalizesAt: toBN(finalizesAt),
            };
            resolve(converted);
          },
        );
      }),
      new Promise(async (resolve, reject) => {
        try {
          const tx = await challengeRegistry.setState(
            setState.appIdentity,
            await setState.getSignedAppChallengeUpdate(),
          );
          const response = await tx.wait();
          resolve(response);
        } catch (e) {
          reject(e.message);
        }
      }),
      mineBlock(provider),
    ]);
    expect((tx as any).transactionHash).to.be.ok;
    await verifyChallengeUpdatedEvent(app, setState.toJson(), event as any, provider);
  };

  const progressState = async (app: AppWithCounterClass = activeApps[0]) => {
    expect(app.latestAction).to.be.ok;
    const setState = SetStateCommitment.fromJson(
      await app.getSingleSignedSetState(networkContext.ChallengeRegistry),
    );
    const tx = await challengeRegistry.progressState(
      app.appIdentity,
      await setState.getSignedAppChallengeUpdate(),
      AppWithCounterClass.encodeState(app.latestState),
      AppWithCounterClass.encodeAction(app.latestAction!),
    );
    return tx.wait();
  };

  const cancelChallenge = async (app: AppWithCounterClass = activeApps[0]) => {
    const tx = await challengeRegistry.cancelDispute(
      app.appIdentity,
      await app.getCancelDisputeRequest(),
    );
    return tx.wait();
  };

  /////////////////////////////////////////
  // store helper functions
  const loadStore = async (store: IStoreService) => {
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
        await app.getDoubleSignedSetState(networkContext.ChallengeRegistry),
      );
    }
  };

  if (shouldLoadStore) {
    await loadStore(store);
  }

  const addActionToAppInStore = async (
    store: IStoreService,
    appPriorToAction: AppWithCounterClass,
    action: AppWithCounterAction = {
      increment: One,
      actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
    },
  ): Promise<AppWithCounterClass> => {
    appPriorToAction.latestAction = action;
    const setState1 = await appPriorToAction.getSingleSignedSetState(
      networkContext.ChallengeRegistry,
    );
    await store.updateAppInstance(multisigAddress, appPriorToAction.toJson(), setState1);
    return appPriorToAction;
  };

  return {
    ethProvider,
    challengeRegistry,
    provider,
    wallet,
    signers,
    store,
    multisigAddress,
    activeApps,
    freeBalance,
    networkContext,
    channelBalances,
    setAndProgressState,
    setState,
    progressState,
    cancelChallenge,
    loadStore,
    addActionToAppInStore,
  };
};
