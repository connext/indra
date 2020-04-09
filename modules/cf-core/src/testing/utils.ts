import {
  AppABIEncodings,
  AppInstanceJson,
  AppInstanceProposal,
  bigNumberifyJson,
  ContractABI,
  CreateChannelMessage,
  deBigNumberifyJson,
  DepositAppState,
  DepositAppStateEncoding,
  Message,
  EventNames,
  InstallMessage,
  MethodNames,
  MethodParam,
  MethodParams,
  MethodResults,
  OutcomeType,
  ProposeMessage,
  ProtocolParams,
  SolidityValueType,
  toBN,
  UninstallMessage,
  getAssetId,
  getAddressFromIdentifier,
  PublicIdentifier,
  AssetId,
  getTokenAddressFromAssetId,
  Address,
  getPublicIdentifier,
} from "@connext/types";
import { Contract, Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { AddressZero, One, Zero } from "ethers/constants";
import { BigNumber, bigNumberify, getAddress, hexlify, randomBytes } from "ethers/utils";
import { JsonRpcResponse, Rpc } from "rpc-server";

import { Node } from "../node";
import { AppInstance, StateChannel } from "../models";

import { DolphinCoin, NetworkContextForTestSuite } from "./contracts";
import { initialLinkedState, linkedAbiEncodings } from "./linked-transfer";
import { initialSimpleTransferState, simpleTransferAbiEncodings } from "./simple-transfer";
import { initialEmptyTTTState, tttAbiEncodings } from "./tic-tac-toe";
import { initialTransferState, transferAbiEncodings } from "./unidirectional-transfer";
import { ERC20, MinimumViableMultisig } from "@connext/contracts";
import { CONTRACT_NOT_DEPLOYED } from "../errors";
import { getRandomChannelSigner } from "./random-signing-keys";

export const GANACHE_CHAIN_ID = 4447;

export const CONVENTION_FOR_ETH_ASSET_ID_GANACHE = getAssetId(GANACHE_CHAIN_ID);

interface AppContext {
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initialState: SolidityValueType;
  outcomeType: OutcomeType;
}

const {
  DepositApp,
  TicTacToeApp,
  SimpleTransferApp,
  UnidirectionalLinkedTransferApp,
  UnidirectionalTransferApp,
} = global[`network`] as NetworkContextForTestSuite;

export const newWallet = (wallet: Wallet) =>
  new Wallet(
    wallet.privateKey,
    new JsonRpcProvider((wallet.provider as JsonRpcProvider).connection.url),
  );

export function createAppInstanceProposalForTest(appIdentityHash: string): AppInstanceProposal {
  return {
    identityHash: appIdentityHash,
    initiatorIdentifier: getRandomChannelSigner().identifier,
    responderIdentifier: getRandomChannelSigner().identifier,
    appDefinition: AddressZero,
    abiEncodings: {
      stateEncoding: "tuple(address foo, uint256 bar)",
      actionEncoding: undefined,
    } as AppABIEncodings,
    initiatorDeposit: "0x00",
    responderDeposit: "0x00",
    defaultTimeout: "0x01",
    stateTimeout: "0x00",
    initialState: {
      foo: AddressZero,
      bar: 0,
    } as SolidityValueType,
    appSeqNo: 0,
    outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
    responderDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
    initiatorDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  };
}

export function createAppInstanceForTest(stateChannel?: StateChannel) {
  const [initiator, responder] = stateChannel
    ? [
      stateChannel!.userPublicIdentifiers[0], 
      stateChannel!.userPublicIdentifiers[1],
    ]
    : [
        getPublicIdentifier(
          GANACHE_CHAIN_ID,
          getAddress(hexlify(randomBytes(20))),
        ),
        getPublicIdentifier(
          GANACHE_CHAIN_ID,
          getAddress(hexlify(randomBytes(20))),
        ),
      ];
  return new AppInstance(
    /* initiator */ initiator,
    /* responder */ responder,
    /* defaultTimeout */ "0x00",
    /* appInterface */ {
      addr: getAddress(hexlify(randomBytes(20))),
      stateEncoding: "tuple(address foo, uint256 bar)",
      actionEncoding: undefined,
    },
    /* appSeqNo */ stateChannel ? stateChannel.numProposedApps : Math.ceil(1000 * Math.random()),
    /* latestState */ { foo: AddressZero, bar: bigNumberify(0) },
    /* latestVersionNumber */ 0,
    /* stateTimeout */ toBN(Math.ceil(1000 * Math.random())).toHexString(),
    /* outcomeType */ OutcomeType.TWO_PARTY_FIXED_OUTCOME,
    /* multisig */ stateChannel
      ? stateChannel.multisigAddress
      : getAddress(hexlify(randomBytes(20))),
    /* meta */ undefined,
    /* twoPartyOutcomeInterpreterParams */ {
      playerAddrs: [AddressZero, AddressZero],
      amount: Zero,
      tokenAddress: AddressZero,
    },
    /* multiAssetMultiPartyCoinTransferInterpreterParams */ undefined,
    /* singleAssetTwoPartyCoinTransferInterpreterParams */ undefined,
  );
}

export async function requestDepositRights(
  depositor: Node,
  counterparty: Node,
  multisigAddress: string,
  assetId: AssetId = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
) {
  const proposeParams = await getProposeDepositAppParams(
    multisigAddress,
    depositor.publicIdentifier,
    counterparty.publicIdentifier,
    assetId,
  );
  const [appIdentityHash] = await installApp(
    depositor,
    counterparty,
    multisigAddress,
    proposeParams.appDefinition,
    proposeParams.initialState,
    proposeParams.initiatorDeposit,
    proposeParams.initiatorDepositAssetId,
    proposeParams.responderDeposit,
    proposeParams.responderDepositAssetId,
    proposeParams.defaultTimeout,
    proposeParams.stateTimeout,
  );
  return appIdentityHash;
}

export async function rescindDepositRights(
  node: Node,
  counterparty: Node,
  multisigAddress: string,
  assetId: AssetId = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
) {
  const apps = await getInstalledAppInstances(node, multisigAddress);
  const depositApp = apps.filter(app => 
    app.appInterface.addr === global[`network`][`DepositApp`] &&
    (app.latestState as DepositAppState).assetId === getTokenAddressFromAssetId(assetId),
  )[0];
  if (!depositApp) {
    // no apps to uninstall, return
    return;
  }
  // uninstall
  await uninstallApp(node, counterparty, depositApp.identityHash);
}

export async function getDepositApps(
  node: Node,
  multisigAddr: string,
  tokenAddresses: string[] = [],
): Promise<AppInstanceJson[]> {
  const apps = await getInstalledAppInstances(node, multisigAddr);
  if (apps.length === 0) {
    return [];
  }
  const depositApps = apps.filter(app => 
    app.appInterface.addr === global[`network`][`DepositApp`],
  );
  if (tokenAddresses.length === 0) {
    return depositApps;
  }
  return depositApps.filter(app =>
    tokenAddresses.includes((app.latestState as DepositAppState).assetId),
  );
}

/**
 * Checks the msg is what is expected, and that specificied keys exist
 * in the message.
 *
 * @param msg msg to check
 * @param expected expected message, can be partial
 * @param shouldExist array of keys to check existence of if value not known
 * for `expected` (e.g `appIdentityHash`s)
 */
export function assertMessage(
  msg: Message,
  expected: any, // should be partial of nested types
  shouldExist: string[] = [],
): void {
  // ensure keys exist, shouldExist is array of
  // keys, ie. data.appIdentityHash
  shouldExist.forEach(key => {
    let subset = { ...msg };
    key.split(`.`).forEach(k => {
      expect(subset[k]).toBeDefined();
      subset = subset[k];
    });
  });
  // cast both to strings instead of BNs
  expect(deBigNumberifyJson(msg)).toMatchObject(deBigNumberifyJson(expected));
}

export function assertProposeMessage(
  senderId: string,
  msg: ProposeMessage,
  params: ProtocolParams.Propose,
) {
  const {
    multisigAddress,
    initiatorIdentifier,
    responderIdentifier: responderIdentifier,
    ...emittedParams
  } = params;
  assertMessage(
    msg,
    {
      from: senderId,
      type: `PROPOSE_INSTALL_EVENT`,
      data: {
        params: {
          ...emittedParams,
          responderIdentifier,
        },
      },
    },
    [`data.appIdentityHash`],
  );
}

export function assertInstallMessage(
  senderId: string,
  msg: InstallMessage,
  appIdentityHash: string,
) {
  assertMessage(msg, {
    from: senderId,
    type: `INSTALL_EVENT`,
    data: {
      params: {
        appIdentityHash,
      },
    },
  });
}

/**
 * Even though this function returns a transaction hash, the calling Node
 * will receive an event (CREATE_CHANNEL) that should be subscribed to to
 * ensure a channel has been instantiated and to get its multisig address
 * back in the event data.
 */
export async function getMultisigCreationAddress(node: Node, addresss: string[]): Promise<string> {
  const {
    result: {
      result: { multisigAddress },
    },
  } = await node.rpcRouter.dispatch(constructChannelCreationRpc(addresss));
  return multisigAddress;
}

export function constructChannelCreationRpc(owners: string[]) {
  return {
    id: Date.now(),
    methodName: MethodNames.chan_create,
    parameters: {
      owners,
    } as MethodParams.CreateChannel,
  };
}

/**
 * Wrapper method making the call to the given node to get the list of
 * multisig addresses the node is aware of.
 * @param node
 * @returns list of multisig addresses
 */
export async function getChannelAddresses(node: Node): Promise<Set<string>> {
  const {
    result: {
      result: { multisigAddresses },
    },
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: MethodNames.chan_getChannelAddresses,
    parameters: {},
  });

  return new Set(multisigAddresses);
}

export async function getAppInstance(
  node: Node,
  appIdentityHash: string,
): Promise<AppInstanceJson> {
  const {
    result: {
      result: { appInstance },
    },
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: MethodNames.chan_getAppInstance,
    parameters: {
      appIdentityHash,
    },
  });

  return appInstance;
}

export async function getAppInstanceProposal(
  node: Node,
  appIdentityHash: string,
  multisigAddress: string,
): Promise<AppInstanceProposal> {
  const proposals = await getProposedAppInstances(node, multisigAddress);
  const candidates = proposals.filter(proposal => proposal.identityHash === appIdentityHash);

  if (candidates.length === 0) {
    throw new Error(`Could not find proposal`);
  }

  if (candidates.length > 1) {
    throw new Error(`Failed to match exactly one proposed app instance`);
  }

  return candidates[0];
}

export async function getFreeBalanceState(
  node: Node,
  multisigAddress: string,
  assetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
): Promise<MethodResults.GetFreeBalanceState> {
  const {
    result: { result },
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: MethodNames.chan_getFreeBalanceState,
    parameters: {
      multisigAddress,
      assetId,
    },
  });

  return result;
}

export async function getTokenIndexedFreeBalanceStates(
  node: Node,
  multisigAddress: string,
): Promise<MethodResults.GetTokenIndexedFreeBalanceStates> {
  const {
    result: { result },
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: MethodNames.chan_getTokenIndexedFreeBalanceStates,
    parameters: {
      multisigAddress,
    },
  });

  return result as MethodResults.GetTokenIndexedFreeBalanceStates;
}

export async function getInstalledAppInstances(
  node: Node,
  multisigAddress: string,
): Promise<AppInstanceJson[]> {
  const rpc = {
    id: Date.now(),
    methodName: MethodNames.chan_getAppInstances,
    parameters: { multisigAddress } as MethodParams.GetAppInstances,
  };
  const response = (await node.rpcRouter.dispatch(rpc)) as JsonRpcResponse;
  const result = response.result.result as MethodResults.GetAppInstances;
  return result.appInstances;
}

export async function getProposedAppInstances(
  node: Node,
  multisigAddress: string,
): Promise<AppInstanceProposal[]> {
  const rpc = {
    id: Date.now(),
    methodName: MethodNames.chan_getProposedAppInstances,
    parameters: { multisigAddress } as MethodParams.GetProposedAppInstances,
  };
  const response = (await node.rpcRouter.dispatch(rpc)) as JsonRpcResponse;
  const result = response.result.result as MethodResults.GetProposedAppInstances;
  return result.appInstances;
}

export async function getMultisigBalance(
  multisigAddr: string,
  tokenAddress: string = AddressZero,
): Promise<BigNumber> {
  const provider = global[`wallet`].provider;
  return tokenAddress === AddressZero
    ? await provider.getBalance(multisigAddr)
    : await new Contract(tokenAddress, ERC20.abi, provider)
        .functions.balanceOf(multisigAddr);
}

export async function getMultisigAmountWithdrawn(
  multisigAddr: string,
  tokenAddress: string = AddressZero,
) {
  const provider = global[`wallet`].provider;
  const multisig = new Contract(multisigAddr, MinimumViableMultisig.abi, provider);
  try {
    return await multisig.functions.totalAmountWithdrawn(tokenAddress);
  } catch (e) {
    if (!e.message.includes(CONTRACT_NOT_DEPLOYED)) {
      console.log(CONTRACT_NOT_DEPLOYED);
      throw new Error(e);
    }
    // multisig is deployed on withdrawal, if not
    // deployed withdrawal amount is 0
    return Zero;
  }
}

export async function getProposeDepositAppParams(
  multisigAddress: string,
  initiatorIdentifier: string,
  responderIdentifier: string,
  assetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
): Promise<MethodParams.ProposeInstall> {
  const tokenAddress = getTokenAddressFromAssetId(assetId);
  const startingTotalAmountWithdrawn = await getMultisigAmountWithdrawn(
    multisigAddress,
    tokenAddress,
  );
  const startingMultisigBalance = await getMultisigBalance(multisigAddress, tokenAddress);
  const initialState: DepositAppState = {
    multisigAddress,
    assetId: tokenAddress,
    startingTotalAmountWithdrawn,
    startingMultisigBalance,
    transfers: [
      {
        amount: Zero,
        to: getAddressFromIdentifier(initiatorIdentifier),
      },
      {
        amount: Zero,
        to: getAddressFromIdentifier(responderIdentifier),
      },
    ],
  };

  return {
    abiEncodings: {
      actionEncoding: undefined,
      stateEncoding: DepositAppStateEncoding,
    },
    appDefinition: DepositApp,
    initialState,
    initiatorDeposit: Zero,
    initiatorDepositAssetId: assetId,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    responderIdentifier,
    responderDeposit: Zero,
    responderDepositAssetId: assetId,
    defaultTimeout: Zero,
    stateTimeout: Zero,
  };
}

export async function deposit(
  node: Node,
  multisigAddress: string,
  amount: BigNumber = One,
  responderNode: Node,
  assetId: AssetId = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
) {
  // get rights
  await requestDepositRights(node, responderNode, multisigAddress, assetId);
  const wallet = global["wallet"] as Wallet;
  // send a deposit to the multisig
  const tx = getTokenAddressFromAssetId(assetId) === AddressZero
    ? await wallet.sendTransaction({
        value: amount,
        to: multisigAddress,
      })
    : await new Contract(getTokenAddressFromAssetId(assetId), ERC20.abi, wallet)
        .transfer(multisigAddress, amount);
  expect(tx.hash).toBeDefined();
  // rescind rights
  await rescindDepositRights(node, responderNode, multisigAddress, assetId);
}

export async function deployStateDepositHolder(node: Node, multisigAddress: string) {
  const response = await node.rpcRouter.dispatch({
    methodName: MethodNames.chan_deployStateDepositHolder,
    parameters: {
      multisigAddress,
    } as MethodParams.DeployStateDepositHolder,
  });

  const result = response.result.result as MethodResults.DeployStateDepositHolder;

  return result.transactionHash;
}

export function constructInstallRpc(appIdentityHash: string): Rpc {
  return {
    id: Date.now(),
    methodName: MethodNames.chan_install,
    parameters: {
      appIdentityHash,
    } as MethodParams.Install,
  };
}

export function constructRejectInstallRpc(appIdentityHash: string): Rpc {
  return {
    id: Date.now(),
    methodName: MethodNames.chan_rejectInstall,
    parameters: {
      appIdentityHash,
    } as MethodParams.RejectInstall,
  };
}

export function constructAppProposalRpc(
  multisigAddress: string,
  responderIdentifier: PublicIdentifier,
  appDefinition: string,
  abiEncodings: AppABIEncodings,
  initialState: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositAssetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  responderDeposit: BigNumber = Zero,
  responderDepositAssetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  defaultTimeout: BigNumber = Zero,
  stateTimeout: BigNumber = defaultTimeout,
): Rpc {
  const { outcomeType } = getAppContext(appDefinition, initialState);
  return {
    id: Date.now(),
    methodName: MethodNames.chan_proposeInstall,
    parameters: deBigNumberifyJson({
      responderIdentifier,
      initiatorDeposit,
      initiatorDepositAssetId,
      responderDeposit,
      responderDepositAssetId,
      appDefinition,
      initialState,
      abiEncodings,
      outcomeType,
      defaultTimeout,
      stateTimeout,
    } as MethodParams.ProposeInstall),
  };
}

/**
 * @param MethodParams.proposal The parameters of the installation proposal.
 * @param appInstanceProposal The proposed app instance contained in the Node.
 */
export function confirmProposedAppInstance(
  methodParams: MethodParam,
  appInstanceProposal: AppInstanceProposal,
  nonInitiatingNode: boolean = false,
) {
  const proposalParams = methodParams as MethodParams.ProposeInstall;
  expect(proposalParams.abiEncodings).toEqual(appInstanceProposal.abiEncodings);
  expect(proposalParams.appDefinition).toEqual(appInstanceProposal.appDefinition);

  if (nonInitiatingNode) {
    expect(proposalParams.initiatorDeposit).toEqual(
      bigNumberify(appInstanceProposal.responderDeposit),
    );
    expect(proposalParams.responderDeposit).toEqual(
      bigNumberify(appInstanceProposal.initiatorDeposit),
    );
  } else {
    expect(proposalParams.initiatorDeposit).toEqual(
      bigNumberify(appInstanceProposal.initiatorDeposit),
    );
    expect(proposalParams.responderDeposit).toEqual(
      bigNumberify(appInstanceProposal.responderDeposit),
    );
  }

  expect(proposalParams.defaultTimeout).toEqual(toBN(appInstanceProposal.defaultTimeout));
  expect(proposalParams.stateTimeout).toEqual(toBN(appInstanceProposal.stateTimeout));

  // TODO: uncomment when getState is implemented
  // expect(proposalParams.initialState).toEqual(appInstanceInitialState);
}

export function constructGetStateChannelRpc(multisigAddress: string): Rpc {
  return {
    parameters: {
      multisigAddress,
    },
    id: Date.now(),
    methodName: MethodNames.chan_getStateChannel,
  };
}

export function constructTakeActionRpc(appIdentityHash: string, action: any): Rpc {
  return {
    parameters: deBigNumberifyJson({
      appIdentityHash,
      action,
    } as MethodParams.TakeAction),
    id: Date.now(),
    methodName: MethodNames.chan_takeAction,
  };
}

export function constructGetAppsRpc(multisigAddress: string): Rpc {
  return {
    parameters: { multisigAddress } as MethodParams.GetAppInstances,
    id: Date.now(),
    methodName: MethodNames.chan_getAppInstances,
  };
}

export function constructUninstallRpc(appIdentityHash: string): Rpc {
  return {
    parameters: {
      appIdentityHash,
    } as MethodParams.Uninstall,
    id: Date.now(),
    methodName: MethodNames.chan_uninstall,
  };
}

export async function collateralizeChannel(
  multisigAddress: string,
  node1: Node,
  node2: Node,
  amount: BigNumber = One,
  assetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  collateralizeNode2: boolean = true,
): Promise<void> {
  await deposit(node1, multisigAddress, amount, node2, assetId);
  if (collateralizeNode2) {
    await deposit(node2, multisigAddress, amount, node1, assetId);
  }
}

export async function createChannel(nodeA: Node, nodeB: Node): Promise<string> {
  const sortedOwners = [
    nodeA.signerAddress,
    nodeB.signerAddress,
  ];
  const [multisigAddress]: any = await Promise.all([
    new Promise(async resolve => {
      nodeB.once(EventNames.CREATE_CHANNEL_EVENT, async (msg: CreateChannelMessage) => {
        assertMessage(
          msg,
          {
            from: nodeA.publicIdentifier,
            type: EventNames.CREATE_CHANNEL_EVENT,
            data: {
              owners: sortedOwners,
            },
          },
          [`data.multisigAddress`],
        );
        expect(await getInstalledAppInstances(nodeB, msg.data.multisigAddress)).toEqual([]);
        resolve(msg.data.multisigAddress);
      });
    }),
    new Promise(resolve => {
      nodeA.once(EventNames.CREATE_CHANNEL_EVENT, (msg: CreateChannelMessage) => {
        assertMessage(
          msg,
          {
            from: nodeA.publicIdentifier,
            type: EventNames.CREATE_CHANNEL_EVENT,
            data: {
              owners: sortedOwners,
              counterpartyIdentifier: nodeB.publicIdentifier,
            },
          },
          [`data.multisigAddress`],
        );
        resolve(msg.data.multisigAddress);
      });
    }),
    getMultisigCreationAddress(nodeA, [
      nodeA.publicIdentifier,
      nodeB.publicIdentifier,
    ]),
  ]);
  expect(multisigAddress).toBeDefined();
  expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
  return multisigAddress;
}

// NOTE: Do not run this concurrently, it won't work
export async function installApp(
  nodeA: Node,
  nodeB: Node,
  multisigAddress: string,
  appDefinition: string,
  initialState?: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositAssetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  responderDeposit: BigNumber = Zero,
  responderDepositAssetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  defaultTimeout: BigNumber = Zero,
  stateTimeout: BigNumber = defaultTimeout,
): Promise<[string, ProtocolParams.Propose]> {
  const appContext = getAppContext(appDefinition, initialState);

  const installationProposalRpc = constructAppProposalRpc(
    multisigAddress,
    nodeB.publicIdentifier,
    appContext.appDefinition,
    appContext.abiEncodings,
    appContext.initialState,
    initiatorDeposit,
    initiatorDepositAssetId,
    responderDeposit,
    responderDepositAssetId,
    defaultTimeout,
    stateTimeout,
  );

  const proposedParams = installationProposalRpc.parameters as ProtocolParams.Propose;

  const appIdentityHash: string = await new Promise(async resolve => {
    nodeB.once(`PROPOSE_INSTALL_EVENT`, async (msg: ProposeMessage) => {
      // assert message
      assertProposeMessage(nodeA.publicIdentifier, msg, proposedParams);
      const {
        data: { appIdentityHash },
      } = msg;
      // Sanity-check
      confirmProposedAppInstance(
        installationProposalRpc.parameters,
        await getAppInstanceProposal(nodeB, appIdentityHash, multisigAddress),
      );
      confirmProposedAppInstance(
        installationProposalRpc.parameters,
        await getAppInstanceProposal(nodeA, appIdentityHash, multisigAddress),
      );
      resolve(msg.data.appIdentityHash);
    });

    await nodeA.rpcRouter.dispatch(installationProposalRpc);
  });

  // send nodeB install call
  await Promise.all([
    nodeB.rpcRouter.dispatch(constructInstallRpc(appIdentityHash)),
    new Promise(async resolve => {
      nodeA.on(EventNames.INSTALL_EVENT, async (msg: InstallMessage) => {
        if (msg.data.params.appIdentityHash === appIdentityHash) {
          // assert message
          assertInstallMessage(nodeB.publicIdentifier, msg, appIdentityHash);
          const appInstanceNodeA = await getAppInstance(nodeA, appIdentityHash);
          const appInstanceNodeB = await getAppInstance(nodeB, appIdentityHash);
          expect(appInstanceNodeA).toEqual(appInstanceNodeB);
          resolve();
        }
      });
    }),
  ]);
  return [appIdentityHash, proposedParams];
}

export async function confirmChannelCreation(
  nodeA: Node,
  nodeB: Node,
  data: MethodResults.CreateChannel,
  owners: Address[], // free balance addr[]
) {
  const openChannelsNodeA = await getChannelAddresses(nodeA);
  const openChannelsNodeB = await getChannelAddresses(nodeB);

  expect(openChannelsNodeA.has(data.multisigAddress)).toBeTruthy();
  expect(openChannelsNodeB.has(data.multisigAddress)).toBeTruthy();
  if (data.owners) {
    expect(data.owners).toMatchObject(owners);
  }
}

export async function confirmAppInstanceInstallation(
  proposedParams: ProtocolParams.Propose,
  appInstance: AppInstanceJson,
) {
  const params = bigNumberifyJson(proposedParams) as ProtocolParams.Propose;
  expect(appInstance.appInterface.addr).toEqual(params.appDefinition);
  expect(appInstance.appInterface.stateEncoding).toEqual(params.abiEncodings.stateEncoding);
  expect(appInstance.appInterface.actionEncoding).toEqual(params.abiEncodings.actionEncoding);
  expect(appInstance.defaultTimeout).toEqual(params.defaultTimeout.toHexString());
  expect(appInstance.stateTimeout).toEqual(params.stateTimeout.toHexString());
  expect(appInstance.latestState).toEqual(params.initialState);
}

export async function makeInstallCall(node: Node, appIdentityHash: string) {
  return await node.rpcRouter.dispatch(constructInstallRpc(appIdentityHash));
}

export function makeProposeCall(
  nodeB: Node,
  appDefinition: string,
  multisigAddress: string,
  initialState?: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositAssetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  responderDeposit: BigNumber = Zero,
  responderDepositAssetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
): Rpc {
  const appContext = getAppContext(appDefinition, initialState);
  return constructAppProposalRpc(
    multisigAddress,
    nodeB.publicIdentifier,
    appContext.appDefinition,
    appContext.abiEncodings,
    appContext.initialState,
    initiatorDeposit,
    initiatorDepositAssetId,
    responderDeposit,
    responderDepositAssetId,
  );
}

export async function makeAndSendProposeCall(
  nodeA: Node,
  nodeB: Node,
  appDefinition: string,
  multisigAddress: string,
  initialState?: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositAssetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  responderDeposit: BigNumber = Zero,
  responderDepositAssetId: string = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
): Promise<{
  appIdentityHash: string;
  params: ProtocolParams.Propose;
}> {
  const installationProposalRpc = makeProposeCall(
    nodeB,
    appDefinition,
    multisigAddress,
    initialState,
    initiatorDeposit,
    initiatorDepositAssetId,
    responderDeposit,
    responderDepositAssetId,
  );

  const {
    result: {
      result: { appIdentityHash },
    },
  } = await nodeA.rpcRouter.dispatch(installationProposalRpc);

  return {
    appIdentityHash,
    params: installationProposalRpc.parameters as ProtocolParams.Propose,
  };
}

/**
 * @return the ERC20 token balance of the receiver
 */
export async function transferERC20Tokens(
  toAddress: string,
  tokenAddress: string = global[`network`][`DolphinCoin`],
  contractABI: ContractABI = DolphinCoin.abi,
  amount: BigNumber = One,
): Promise<BigNumber> {
  const deployerAccount = global["wallet"];
  const contract = new Contract(tokenAddress, contractABI, deployerAccount);
  const balanceBefore: BigNumber = await contract.functions.balanceOf(toAddress);
  await contract.functions.transfer(toAddress, amount);
  const balanceAfter: BigNumber = await contract.functions.balanceOf(toAddress);
  expect(balanceAfter.sub(balanceBefore)).toEqual(amount);
  return balanceAfter;
}

export function getAppContext(
  appDefinition: string,
  initialState?: SolidityValueType,
  senderAddress?: string, // needed for both types of transfer apps
  receiverAddress?: string, // needed for both types of transfer apps
): AppContext {
  const checkForAddresses = () => {
    const missingAddr = !senderAddress || !receiverAddress;
    if (missingAddr && !initialState) {
      throw new Error(
        `Must have sender and redeemer addresses to generate initial state for either transfer app context`,
      );
    }
  };
  const checkForInitialState = () => {
    if (!initialState) {
      throw new Error(
        `Must have initial state to generate app context`,
      );
    }
  };

  switch (appDefinition) {
    case TicTacToeApp:
      return {
        appDefinition,
        abiEncodings: tttAbiEncodings,
        initialState: initialState || initialEmptyTTTState(),
        outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      };

    case UnidirectionalTransferApp:
      checkForAddresses();
      return {
        appDefinition,
        initialState: initialState || initialTransferState(senderAddress!, receiverAddress!),
        abiEncodings: transferAbiEncodings,
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
      };

    case UnidirectionalLinkedTransferApp:
      checkForAddresses();
      // TODO: need a better way to return the action info that generated
      // the linked hash as well
      const { state } = initialLinkedState(senderAddress!, receiverAddress!);
      return {
        appDefinition,
        initialState: initialState || state,
        abiEncodings: linkedAbiEncodings,
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
      };

    case SimpleTransferApp:
      checkForAddresses();
      return {
        appDefinition,
        initialState: initialState || initialSimpleTransferState(senderAddress!, receiverAddress!),
        abiEncodings: simpleTransferAbiEncodings,
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
      };

    case DepositApp:
      checkForInitialState();
      return {
        appDefinition,
        initialState: initialState!,
        abiEncodings: {
          stateEncoding: DepositAppStateEncoding,
          actionEncoding: undefined,
        },
        outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
      };

    default:
      throw new Error(`Proposing the specified app is not supported: ${appDefinition}`);
  }
}

export async function takeAppAction(node: Node, appIdentityHash: string, action: any) {
  const res = await node.rpcRouter.dispatch(constructTakeActionRpc(appIdentityHash, action));
  return res.result.result;
}

export async function uninstallApp(
  node: Node,
  counterparty: Node,
  appIdentityHash: string,
): Promise<string> {
  await Promise.all([
    node.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash)),
    new Promise(resolve => {
      counterparty.once(EventNames.UNINSTALL_EVENT, (msg: UninstallMessage) => {
        expect(msg.data.appIdentityHash).toBe(appIdentityHash);
        resolve(appIdentityHash);
      });
    }),
  ]);
  return appIdentityHash;
}

export async function getApps(node: Node, multisigAddress: string): Promise<AppInstanceJson[]> {
  return (await node.rpcRouter.dispatch(constructGetAppsRpc(multisigAddress))).result.result
    .appInstances;
}

export async function getBalances(
  nodeA: Node,
  nodeB: Node,
  multisigAddress: string,
  assetId: AssetId,
): Promise<[BigNumber, BigNumber]> {
  let tokenFreeBalanceState = await getFreeBalanceState(
    nodeA, 
    multisigAddress, 
    assetId,
  );

  const tokenBalanceNodeA = tokenFreeBalanceState[nodeA.signerAddress];

  tokenFreeBalanceState = await getFreeBalanceState(
    nodeB,
    multisigAddress,
    assetId,
  );

  const tokenBalanceNodeB = tokenFreeBalanceState[nodeB.signerAddress];

  return [tokenBalanceNodeA, tokenBalanceNodeB];
}
