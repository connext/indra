import { ChallengeRegistry, AppWithAction } from "@connext/contracts";
import {
  JsonRpcProvider,
  BigNumber,
  StateChannelJSON,
  StateSchemaVersion,
  CONVENTION_FOR_ETH_ASSET_ID,
  NetworkContext,
  OutcomeType,
} from "@connext/types";
import {
  getRandomAddress,
  computeAppChallengeHash,
  ChannelSigner,
  toBN,
  bigNumberifyJson,
} from "@connext/utils";
import { Wallet, Contract } from "ethers";
import { One, Zero, HashZero } from "ethers/constants";
import { keccak256 } from "ethers/utils";

import {
  AppWithCounterClass,
  AppWithCounterState,
  AppWithCounterAction,
  ActionType,
} from "./appWithCounter";
import { ConnextStore } from "@connext/store";
import { MiniFreeBalance } from "./miniFreeBalance";
import { deployTestArtifactsToChain } from "./contracts";

/////////////////////////////
// Context

export const setupContext = async () => {
  const ethProvider = process.env.ETHPROVIDER_URL;

  // deploy contracts
  const provider = new JsonRpcProvider(ethProvider);
  const wallet = Wallet.fromMnemonic(process.env.SUGAR_DADDY!).connect(provider);

  const networkContext = await deployTestArtifactsToChain(wallet);
  const challengeRegistry = new Contract(
    networkContext.ChallengeRegistry,
    ChallengeRegistry.abi,
    wallet,
  );

  // setup constants
  const channelInitiator = Wallet.createRandom().connect(provider);
  const channelResponder = Wallet.createRandom().connect(provider);
  const multisigAddress = getRandomAddress();
  const signers = [
    new ChannelSigner(channelInitiator.privateKey, ethProvider),
    new ChannelSigner(channelResponder.privateKey, ethProvider),
  ];

  const appInstance = new AppWithCounterClass(
    signers,
    multisigAddress,
    networkContext.AppWithAction,
    One, // default timeout
    One, // channel nonce
  );

  // contract helper functions
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

  const loadStoreWithChannelAndApp = async (store: ConnextStore) => {
    // generate the app, free balance and channel
    const freeBalance = new MiniFreeBalance(
      signers,
      multisigAddress,
      {
        [CONVENTION_FOR_ETH_ASSET_ID]: [
          { to: signers[0].address, amount: Zero },
          { to: signers[1].address, amount: Zero },
        ],
      },
      toBN(2),
      [appInstance.identityHash],
    );
    const freeBalanceSetState = await freeBalance.getSetState(challengeRegistry.address);
    console.log(`created free balance commitment`);

    const appJson = appInstance.toJson();
    const setState = await appInstance.getSetState(challengeRegistry.address);
    const conditional = await appInstance.getConditional(
      freeBalance.identityHash,
      networkContext,
    );
    console.log(`created app commitments`);

    const channel: StateChannelJSON = {
      schemaVersion: StateSchemaVersion,
      multisigAddress,
      addresses: {
        proxyFactory: getRandomAddress(),
        multisigMastercopy: getRandomAddress(),
      },
      userIdentifiers: [signers[0].publicIdentifier, signers[1].publicIdentifier],
      proposedAppInstances: [],
      appInstances: [[appJson.identityHash, appJson]],
      freeBalanceAppInstance: freeBalance.toJson(),
      monotonicNumProposedApps: 2,
    };
    console.log(`created channel json`);
    await store.createStateChannel(
      channel,
      {
        to: multisigAddress,
        value: 0,
        data: HashZero,
      },
      freeBalanceSetState,
    );
    console.log(`saved channel to db`);

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
      initiatorDeposit: appInstance.tokenIndexedBalances[CONVENTION_FOR_ETH_ASSET_ID][0].toString(),
      initiatorDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID,
      responderDeposit: appInstance.tokenIndexedBalances[CONVENTION_FOR_ETH_ASSET_ID][1].toString(),
      responderDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID,
      twoPartyOutcomeInterpreterParams: bigNumberifyJson(twoPartyOutcomeInterpreterParams),
    };
    console.log(`created app proposal`);
    await store.createAppProposal(multisigAddress, proposal as any, appJson.appSeqNo, setState);
    console.log(`saved proposal to db`);
    await store.createAppInstance(
      multisigAddress,
      appJson,
      freeBalance.toJson(),
      freeBalanceSetState,
      conditional,
    );
    console.log(`saved app instance to db`);
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
    networkContext,
    setAndProgressState,
    loadStoreWithChannelAndApp,
  };
};
