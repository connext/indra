import { ChallengeRegistry, ERC20, ProxyFactory, MinimumViableMultisig } from "@connext/contracts";
import {
  JsonRpcProvider,
  BigNumber,
  StateChannelJSON,
  StateSchemaVersion,
  CONVENTION_FOR_ETH_ASSET_ID,
  OutcomeType,
} from "@connext/types";
import {
  computeAppChallengeHash,
  ChannelSigner,
  toBN,
  bigNumberifyJson,
  toBNJson,
} from "@connext/utils";
import { Wallet, Contract } from "ethers";
import { One, Zero, HashZero } from "ethers/constants";
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

/////////////////////////////
// Context

export const setupContext = async () => {
  // setup constants
  const ethProvider = process.env.ETHPROVIDER_URL;
  const provider = new JsonRpcProvider(ethProvider);

  const wallet = Wallet.fromMnemonic(process.env.SUGAR_DADDY!).connect(provider);
  const channelInitiator = Wallet.createRandom().connect(provider);
  const channelResponder = Wallet.createRandom().connect(provider);
  const signers = [
    new ChannelSigner(channelInitiator.privateKey, ethProvider),
    new ChannelSigner(channelResponder.privateKey, ethProvider),
  ];

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
        [channelInitiator.address, channelResponder.address],
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
  const appBalances = {
    [CONVENTION_FOR_ETH_ASSET_ID]: [
      { to: signers[0].address, amount: One },
      { to: signers[1].address, amount: Zero },
    ],
  };
  const appInstance = new AppWithCounterClass(
    signers,
    multisigAddress,
    networkContext.AppWithAction,
    Zero, // default timeout
    One, // channel nonce
    appBalances,
  );

  const freeBalance = new MiniFreeBalance(
    signers,
    multisigAddress,
    {
      [CONVENTION_FOR_ETH_ASSET_ID]: [
        { to: signers[0].address, amount: Zero },
        { to: signers[1].address, amount: Zero },
      ],
    },
    networkContext,
    toBN(2),
    [appInstance.identityHash],
  );

  // fund multisig
  await wallet.sendTransaction({
    to: multisigAddress,
    value: One,
  });

  const ethBalance = await provider.getBalance(multisigAddress);
  expect(ethBalance).to.be.eq(One);

  const setAndProgressState = async (
    versionNumber: BigNumber,
    state: AppWithCounterState,
    action: AppWithCounterAction,
    timeout: BigNumber = Zero,
    turnTaker: Wallet = channelResponder,
  ) => {
    const stateHash = keccak256(AppWithCounterClass.encodeState(state));
    const stateDigest = computeAppChallengeHash(
      appInstance.identityHash,
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
      appInstance.identityHash,
      resultingStateHash,
      One.add(versionNumber),
      timeout2,
    );

    const signatures = [
      await new ChannelSigner(channelInitiator.privateKey, ethProvider).signMessage(stateDigest),
      await new ChannelSigner(channelResponder.privateKey, ethProvider).signMessage(stateDigest),
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
      signatures: [
        await new ChannelSigner(turnTaker.privateKey, ethProvider).signMessage(
          resultingStateDigest,
        ),
      ],
    };
    return challengeRegistry.functions.setAndProgressState(
      appInstance.appIdentity,
      req1,
      req2,
      AppWithCounterClass.encodeState(state),
      AppWithCounterClass.encodeAction(action),
    );
  };

  // store helper function
  const loadStoreWithChannelAndApp = async (store: ConnextStore) => {
    // generate the app, free balance and channel
    const freeBalanceSetState = await freeBalance.getSetState(challengeRegistry.address);

    const appJson = appInstance.toJson();
    const setState = await appInstance.getSetState(challengeRegistry.address);
    const conditional = await appInstance.getConditional(freeBalance.identityHash, networkContext);

    const channel: StateChannelJSON = {
      schemaVersion: StateSchemaVersion,
      multisigAddress,
      addresses: {
        proxyFactory: networkContext.ProxyFactory,
        multisigMastercopy: networkContext.MinimumViableMultisig,
      },
      userIdentifiers: [signers[0].publicIdentifier, signers[1].publicIdentifier],
      proposedAppInstances: [],
      appInstances: [[appJson.identityHash, appJson]],
      freeBalanceAppInstance: freeBalance.toJson(),
      monotonicNumProposedApps: 2,
    };
    await store.createStateChannel(
      channel,
      {
        to: multisigAddress,
        value: 0,
        data: HashZero,
      },
      { ...freeBalanceSetState, versionNumber: toBNJson(One) },
    );

    // add the app + all commitments to the store
    const {
      appInterface,
      latestState,
      latestVersionNumber,
      latestAction,
      twoPartyOutcomeInterpreterParams,
      ...proposalFields
    } = appJson;
    const proposal = {
      ...proposalFields,
      initialState: latestState,
      abiEncodings: {
        stateEncoding: appInterface.stateEncoding,
        actionEncoding: appInterface.actionEncoding,
      },
      outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      appDefinition: appInterface.addr,
      initiatorDeposit: appInstance.tokenIndexedBalances[
        CONVENTION_FOR_ETH_ASSET_ID
      ][0].amount.toString(),
      initiatorDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID,
      responderDeposit: appInstance.tokenIndexedBalances[
        CONVENTION_FOR_ETH_ASSET_ID
      ][1].amount.toString(),
      responderDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID,
      twoPartyOutcomeInterpreterParams: bigNumberifyJson(twoPartyOutcomeInterpreterParams),
    };
    await store.createAppProposal(multisigAddress, proposal as any, appJson.appSeqNo, setState);
    await store.createAppInstance(
      multisigAddress,
      appJson,
      freeBalance.toJson(),
      freeBalanceSetState,
      // latest free balance saved when channel created, use dummy values
      // with increasing app numbers so they get deleted properly
      conditional,
    );
  };

  return {
    ethProvider,
    challengeRegistry,
    provider,
    wallet,
    channelInitiator,
    channelResponder,
    multisigAddress,
    appInstance,
    freeBalance,
    networkContext,
    setAndProgressState,
    loadStoreWithChannelAndApp,
  };
};
