import {
  AppABIEncodings,
  AppInstanceJson,
  AppInstanceProposal,
  CFCoreTypes,
  ContractABI,
  CreateChannelMessage,
  InstallMessage,
  InstallVirtualMessage,
  OutcomeType,
  ProposeMessage,
  ProtocolTypes,
  SolidityValueType,
  UninstallMessage,
  UninstallVirtualMessage,
  CREATE_CHANNEL_EVENT,
  UNINSTALL_EVENT
} from "@connext/types";
import { Contract, Wallet } from "ethers";
import { AddressZero, One, Zero, HashZero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { BigNumber, bigNumberify } from "ethers/utils";

import { JsonRpcResponse, Node, Rpc } from "../../src";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../src/constants";
import { DolphinCoin, NetworkContextForTestSuite } from "../contracts";
import { xkeyKthAddress, xkeysToSortedKthAddresses } from "../../src/machine";

import { initialLinkedState, linkedAbiEncodings } from "./linked-transfer";
import {
  initialSimpleTransferState,
  simpleTransferAbiEncodings
} from "./simple-transfer";
import { initialEmptyTTTState, tttAbiEncodings } from "./tic-tac-toe";
import {
  initialTransferState,
  transferAbiEncodings
} from "./unidirectional-transfer";
import {
  DepositConfirmationMessage,
  DepositStartedMessage,
  EventEmittedMessage,
  ProposeInstallProtocolParams,
  DomainSeparator
} from "../../src/types";
import { deBigNumberifyJson, bigNumberifyJson } from "../../src/utils";

interface AppContext {
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initialState: SolidityValueType;
  outcomeType: OutcomeType;
}

const {
  CoinBalanceRefundApp,
  TicTacToeApp,
  SimpleTransferApp,
  UnidirectionalLinkedTransferApp,
  UnidirectionalTransferApp
} = global[`networkContext`] as NetworkContextForTestSuite;

export const testDomainSeparator: DomainSeparator = {
  domainName: "CounterFactual Test",
  domainVersion: "0.0.1",
  domainSalt: HashZero
}

export async function requestDepositRights(
  node: Node,
  multisigAddress: string,
  tokenAddress: string = AddressZero
) {
  return await node.rpcRouter.dispatch(
    constructRequestDepositRightsRpcCall(multisigAddress, tokenAddress)
  );
}

export function constructRequestDepositRightsRpcCall(
  multisigAddress: string,
  tokenAddress: string = AddressZero
) {
  return {
    id: Date.now(),
    methodName: ProtocolTypes.chan_requestDepositRights,
    parameters: {
      multisigAddress,
      tokenAddress
    }
  };
}

export async function rescindDepositRights(
  node: Node,
  multisigAddress: string,
  tokenAddress: string = AddressZero
) {
  return await node.rpcRouter.dispatch(
    constructRescindDepositRightsRpcCall(multisigAddress, tokenAddress)
  );
}

export function constructRescindDepositRightsRpcCall(
  multisigAddress: string,
  tokenAddress: string = AddressZero
) {
  return {
    id: Date.now(),
    methodName: ProtocolTypes.chan_rescindDepositRights,
    parameters: {
      multisigAddress,
      tokenAddress
    }
  };
}

/**
 * Checks the msg is what is expected, and that specificied keys exist
 * in the message.
 *
 * @param msg msg to check
 * @param expected expected message, can be partial
 * @param shouldExist array of keys to check existence of if value not known
 * for `expected` (e.g `appInstanceId`s)
 */
export function assertNodeMessage(
  msg: EventEmittedMessage,
  expected: any, // should be partial of nested types
  shouldExist: string[] = []
): void {
  // ensure keys exist, shouldExist is array of
  // keys, ie. data.appInstanceId
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
  params: ProposeInstallProtocolParams
) {
  const {
    multisigAddress,
    initiatorXpub,
    responderXpub: proposedToIdentifier,
    ...emittedParams
  } = params;
  assertNodeMessage(
    msg,
    {
      from: senderId,
      type: `PROPOSE_INSTALL_EVENT`,
      data: {
        params: {
          ...emittedParams,
          proposedToIdentifier
        }
      }
    },
    [`data.appInstanceId`]
  );
}

export function assertInstallMessage(
  senderId: string,
  msg: InstallMessage,
  appInstanceId: string
) {
  assertNodeMessage(msg, {
    from: senderId,
    type: `INSTALL_EVENT`,
    data: {
      params: {
        appInstanceId
      }
    }
  });
}

/**
 * Even though this function returns a transaction hash, the calling Node
 * will receive an event (CREATE_CHANNEL) that should be subscribed to to
 * ensure a channel has been instantiated and to get its multisig address
 * back in the event data.
 */
export async function getMultisigCreationAddress(
  node: Node,
  xpubs: string[]
): Promise<string> {
  const {
    result: {
      result: { multisigAddress }
    }
  } = await node.rpcRouter.dispatch(constructChannelCreationRpc(xpubs));

  return multisigAddress;
}

export function constructChannelCreationRpc(owners: string[]) {
  return {
    id: Date.now(),
    methodName: ProtocolTypes.chan_create,
    parameters: {
      owners
    }
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
      result: { multisigAddresses }
    }
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: ProtocolTypes.chan_getChannelAddresses,
    parameters: {}
  });

  return new Set(multisigAddresses);
}

export async function getAppInstance(
  node: Node,
  appInstanceId: string
): Promise<AppInstanceJson> {
  const {
    result: {
      result: { appInstance }
    }
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: ProtocolTypes.chan_getAppInstance,
    parameters: {
      appInstanceId
    }
  });

  return appInstance;
}

export async function getAppInstanceProposal(
  node: Node,
  appInstanceId: string
): Promise<AppInstanceProposal> {
  const candidates = (await getProposedAppInstances(node)).filter(
    proposal => proposal.identityHash === appInstanceId
  );

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
  tokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS
): Promise<CFCoreTypes.GetFreeBalanceStateResult> {
  const {
    result: { result }
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: ProtocolTypes.chan_getFreeBalanceState,
    parameters: {
      multisigAddress,
      tokenAddress
    }
  });

  return result;
}

export async function getTokenIndexedFreeBalanceStates(
  node: Node,
  multisigAddress: string
): Promise<CFCoreTypes.GetTokenIndexedFreeBalanceStatesResult> {
  const {
    result: { result }
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: ProtocolTypes.chan_getTokenIndexedFreeBalanceStates,
    parameters: {
      multisigAddress
    }
  });

  return result as CFCoreTypes.GetTokenIndexedFreeBalanceStatesResult;
}

export async function getInstalledAppInstances(
  node: Node
): Promise<AppInstanceJson[]> {
  const rpc = {
    id: Date.now(),
    methodName: ProtocolTypes.chan_getAppInstances,
    parameters: {} as CFCoreTypes.GetAppInstancesParams
  };
  const response = (await node.rpcRouter.dispatch(rpc)) as JsonRpcResponse;
  const result = response.result.result as CFCoreTypes.GetAppInstancesResult;
  return result.appInstances;
}

export async function getProposedAppInstances(
  node: Node
): Promise<AppInstanceProposal[]> {
  const rpc = {
    id: Date.now(),
    methodName: ProtocolTypes.chan_getProposedAppInstances,
    parameters: {} as CFCoreTypes.GetProposedAppInstancesParams
  };
  const response = (await node.rpcRouter.dispatch(rpc)) as JsonRpcResponse;
  const result = response.result
    .result as CFCoreTypes.GetProposedAppInstancesResult;
  return result.appInstances;
}

export async function getProposeCoinBalanceRefundAppParams(
  multisigAddress: string,
  balanceRefundRecipientIdentifer: string,
  proposedToIdentifier: string,
  tokenAddress: string = AddressZero
): Promise<CFCoreTypes.ProposeInstallParams> {
  const provider = new JsonRpcProvider(global[`ganacheURL`]);
  let threshold: BigNumber;
  if (tokenAddress === AddressZero) {
    threshold = await provider.getBalance(multisigAddress);
  } else {
    const contract = new Contract(tokenAddress, DolphinCoin.abi, provider);
    threshold = await contract.balanceOf(multisigAddress);
  }
  return {
    abiEncodings: {
      actionEncoding: undefined,
      stateEncoding:
        `tuple(address recipient, address multisig, uint256 threshold, address tokenAddress)`
    },
    appDefinition: CoinBalanceRefundApp,
    initialState: {
      multisig: multisigAddress,
      recipient: xkeyKthAddress(balanceRefundRecipientIdentifer, 0),
      threshold,
      tokenAddress
    },
    initiatorDeposit: Zero,
    initiatorDepositTokenAddress: tokenAddress,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    proposedToIdentifier,
    responderDeposit: Zero,
    responderDepositTokenAddress: tokenAddress,
    timeout: Zero
  };
}

export async function deposit(
  node: Node,
  multisigAddress: string,
  amount: BigNumber = One,
  proposedToNode: Node,
  tokenAddress?: string
) {
  const proposeParams = await getProposeCoinBalanceRefundAppParams(
    multisigAddress,
    node.publicIdentifier,
    proposedToNode.publicIdentifier,
    tokenAddress
  );
  await new Promise(async resolve => {
    proposedToNode.once(`PROPOSE_INSTALL_EVENT`, (msg: ProposeMessage) => {
      // TODO: assert this?
      // assertNodeMessage(msg, {
      //   from: node.publicIdentifier,
      //   type: "PROPOSE_INSTALL_EVENT",
      //   data: proposeParams
      // });
      resolve();
    });

    node.rpcRouter.dispatch({
      id: Date.now(),
      methodName: ProtocolTypes.chan_proposeInstall,
      parameters: proposeParams
    });
  });
  const depositReq = constructDepositRpc(multisigAddress, amount, tokenAddress);

  return new Promise(async resolve => {
    node.once(`DEPOSIT_CONFIRMED_EVENT`, (msg: DepositConfirmationMessage) => {
      assertNodeMessage(msg, {
        from: node.publicIdentifier,
        type: `DEPOSIT_CONFIRMED_EVENT`,
        data: {
          multisigAddress,
          amount,
          tokenAddress: tokenAddress || AddressZero
        }
      });
      resolve();
    });

    node.once(`DEPOSIT_STARTED_EVENT`, (msg: DepositStartedMessage) => {
      assertNodeMessage(
        msg,
        {
          from: node.publicIdentifier,
          type: `DEPOSIT_STARTED_EVENT`,
          data: {
            value: amount
          }
        },
        [`data.txHash`]
      );
    });

    // TODO: how to test deposit failed events?
    await node.rpcRouter.dispatch(depositReq);
  });
}

export async function deployStateDepositHolder(
  node: Node,
  multisigAddress: string
) {
  const response = await node.rpcRouter.dispatch({
    methodName: ProtocolTypes.chan_deployStateDepositHolder,
    parameters: {
      multisigAddress
    } as CFCoreTypes.DeployStateDepositHolderParams
  });

  const result = response.result
    .result as CFCoreTypes.DeployStateDepositHolderResult;

  return result.transactionHash;
}

export function constructDepositRpc(
  multisigAddress: string,
  amount: BigNumber,
  tokenAddress?: string
): Rpc {
  return {
    id: Date.now(),
    methodName: ProtocolTypes.chan_deposit,
    parameters: deBigNumberifyJson({
      multisigAddress,
      amount,
      tokenAddress
    })
  };
}

export function constructWithdrawCommitmentRpc(
  multisigAddress: string,
  amount: BigNumber,
  tokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  recipient?: string
): Rpc {
  const withdrawCommitmentReq = constructWithdrawRpc(
    multisigAddress,
    amount,
    tokenAddress,
    recipient
  );

  withdrawCommitmentReq.methodName = ProtocolTypes.chan_withdrawCommitment;

  return withdrawCommitmentReq;
}

export function constructWithdrawRpc(
  multisigAddress: string,
  amount: BigNumber,
  tokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  recipient?: string
): Rpc {
  return {
    id: Date.now(),
    methodName: ProtocolTypes.chan_withdraw,
    parameters: deBigNumberifyJson({
      tokenAddress,
      multisigAddress,
      amount,
      recipient
    }) as CFCoreTypes.WithdrawParams
  };
}

export function constructInstallRpc(appInstanceId: string): Rpc {
  return {
    id: Date.now(),
    methodName: ProtocolTypes.chan_install,
    parameters: {
      appInstanceId
    } as CFCoreTypes.InstallParams
  };
}

export function constructRejectInstallRpc(appInstanceId: string): Rpc {
  return {
    id: Date.now(),
    methodName: ProtocolTypes.chan_rejectInstall,
    parameters: {
      appInstanceId
    } as CFCoreTypes.RejectInstallParams
  };
}

export function constructAppProposalRpc(
  proposedToIdentifier: string,
  appDefinition: string,
  abiEncodings: AppABIEncodings,
  initialState: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  responderDeposit: BigNumber = Zero,
  responderDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS
): Rpc {
  const { outcomeType } = getAppContext(appDefinition, initialState);
  return {
    id: Date.now(),
    methodName: ProtocolTypes.chan_proposeInstall,
    parameters: deBigNumberifyJson({
      proposedToIdentifier,
      initiatorDeposit,
      initiatorDepositTokenAddress,
      responderDeposit,
      responderDepositTokenAddress,
      appDefinition,
      initialState,
      abiEncodings,
      outcomeType,
      timeout: One
    } as CFCoreTypes.ProposeInstallParams)
  };
}

export function constructInstallVirtualRpc(
  appInstanceId: string,
  intermediaryIdentifier: string
): Rpc {
  return {
    parameters: {
      appInstanceId,
      intermediaryIdentifier
    } as CFCoreTypes.InstallVirtualParams,
    id: Date.now(),
    methodName: ProtocolTypes.chan_installVirtual
  };
}

export function constructVirtualProposalRpc(
  proposedToIdentifier: string,
  appDefinition: string,
  abiEncodings: AppABIEncodings,
  initialState: SolidityValueType = {},
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositTokenAddress = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  responderDeposit: BigNumber = Zero,
  responderDepositTokenAddress = CONVENTION_FOR_ETH_TOKEN_ADDRESS
): Rpc {
  const installProposalParams = constructAppProposalRpc(
    proposedToIdentifier,
    appDefinition,
    abiEncodings,
    initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDeposit,
    responderDepositTokenAddress
  ).parameters as CFCoreTypes.ProposeInstallParams;

  return {
    parameters: installProposalParams,
    id: Date.now(),
    methodName: ProtocolTypes.chan_proposeInstall
  };
}

/**
 * @param proposalParams The parameters of the installation proposal.
 * @param appInstanceProposal The proposed app instance contained in the Node.
 */
export function confirmProposedAppInstance(
  methodParams: CFCoreTypes.MethodParams,
  appInstanceProposal: AppInstanceProposal,
  nonInitiatingNode: boolean = false
) {
  const proposalParams = methodParams as CFCoreTypes.ProposeInstallParams;
  expect(proposalParams.abiEncodings).toEqual(appInstanceProposal.abiEncodings);
  expect(proposalParams.appDefinition).toEqual(
    appInstanceProposal.appDefinition
  );

  if (nonInitiatingNode) {
    expect(proposalParams.initiatorDeposit).toEqual(
      bigNumberify(appInstanceProposal.responderDeposit)
    );
    expect(proposalParams.responderDeposit).toEqual(
      bigNumberify(appInstanceProposal.initiatorDeposit)
    );
  } else {
    expect(proposalParams.initiatorDeposit).toEqual(
      bigNumberify(appInstanceProposal.initiatorDeposit)
    );
    expect(proposalParams.responderDeposit).toEqual(
      bigNumberify(appInstanceProposal.responderDeposit)
    );
  }

  expect(proposalParams.timeout).toEqual(
    bigNumberify(appInstanceProposal.timeout)
  );

  // TODO: uncomment when getState is implemented
  // expect(proposalParams.initialState).toEqual(appInstanceInitialState);
}

export function constructGetStateRpc(appInstanceId: string): Rpc {
  return {
    parameters: {
      appInstanceId
    },
    id: Date.now(),
    methodName: ProtocolTypes.chan_getState
  };
}

export function constructTakeActionRpc(
  appInstanceId: string,
  action: any
): Rpc {
  return {
    parameters: deBigNumberifyJson({
      appInstanceId,
      action
    } as CFCoreTypes.TakeActionParams),
    id: Date.now(),
    methodName: ProtocolTypes.chan_takeAction
  };
}

export function constructGetAppsRpc(): Rpc {
  return {
    parameters: {},
    id: Date.now(),
    methodName: ProtocolTypes.chan_getAppInstances
  };
}

export function constructUninstallRpc(appInstanceId: string): Rpc {
  return {
    parameters: {
      appInstanceId
    } as CFCoreTypes.UninstallParams,
    id: Date.now(),
    methodName: ProtocolTypes.chan_uninstall
  };
}

export function constructUninstallVirtualRpc(
  appInstanceId: string,
  intermediaryIdentifier: string
): Rpc {
  return {
    parameters: {
      appInstanceId,
      intermediaryIdentifier
    } as CFCoreTypes.UninstallVirtualParams,
    id: Date.now(),
    methodName: ProtocolTypes.chan_uninstallVirtual
  };
}

export async function collateralizeChannel(
  multisigAddress: string,
  node1: Node,
  node2: Node,
  amount: BigNumber = One,
  tokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  collateralizeNode2: boolean = true
): Promise<void> {
  await deposit(node1, multisigAddress, amount, node2, tokenAddress);
  if (collateralizeNode2) {
    await deposit(node2, multisigAddress, amount, node1, tokenAddress);
  }
}

export async function createChannel(nodeA: Node, nodeB: Node): Promise<string> {
  return new Promise(async resolve => {
    const sortedOwners = xkeysToSortedKthAddresses(
      [nodeA.publicIdentifier, nodeB.publicIdentifier],
      0
    );
    nodeB.once(CREATE_CHANNEL_EVENT, async (msg: CreateChannelMessage) => {
      assertNodeMessage(
        msg,
        {
          from: nodeA.publicIdentifier,
          type: CREATE_CHANNEL_EVENT,
          data: {
            owners: sortedOwners,
            counterpartyXpub: nodeA.publicIdentifier
          }
        },
        [`data.multisigAddress`]
      );
      expect(await getInstalledAppInstances(nodeB)).toEqual([]);
      resolve(msg.data.multisigAddress);
    });

    nodeA.once(CREATE_CHANNEL_EVENT, (msg: CreateChannelMessage) => {
      assertNodeMessage(
        msg,
        {
          from: nodeA.publicIdentifier,
          type: CREATE_CHANNEL_EVENT,
          data: {
            owners: sortedOwners,
            counterpartyXpub: nodeB.publicIdentifier
          }
        },
        [`data.multisigAddress`]
      );
    });

    // trigger channel creation but only resolve with the multisig address
    // as acknowledged by the node
    await getMultisigCreationAddress(nodeA, [
      nodeA.publicIdentifier,
      nodeB.publicIdentifier
    ]);

    expect(await getInstalledAppInstances(nodeA)).toEqual([]);
  });
}

// NOTE: Do not run this concurrently, it won't work
export async function installApp(
  nodeA: Node,
  nodeB: Node,
  appDefinition: string,
  initialState?: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  responderDeposit: BigNumber = Zero,
  responderDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS
): Promise<[string, ProposeInstallProtocolParams]> {
  const appContext = getAppContext(appDefinition, initialState);

  const installationProposalRpc = constructAppProposalRpc(
    nodeB.publicIdentifier,
    appContext.appDefinition,
    appContext.abiEncodings,
    appContext.initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDeposit,
    responderDepositTokenAddress
  );

  const proposedParams = installationProposalRpc.parameters as ProposeInstallProtocolParams;

  return new Promise(async resolve => {
    nodeB.once(`PROPOSE_INSTALL_EVENT`, async (msg: ProposeMessage) => {
      // assert message
      assertProposeMessage(nodeA.publicIdentifier, msg, proposedParams);

      const {
        data: { appInstanceId }
      } = msg;

      // Sanity-check
      confirmProposedAppInstance(
        installationProposalRpc.parameters,
        await getAppInstanceProposal(nodeA, appInstanceId)
      );

      nodeA.once(`INSTALL_EVENT`, async (msg: InstallMessage) => {
        if (msg.data.params.appInstanceId === appInstanceId) {
          // assert message
          assertInstallMessage(nodeB.publicIdentifier, msg, appInstanceId);
          const appInstanceNodeA = await getAppInstance(nodeA, appInstanceId);
          const appInstanceNodeB = await getAppInstance(nodeB, appInstanceId);
          expect(appInstanceNodeA).toEqual(appInstanceNodeB);
          resolve([appInstanceId, proposedParams]);
        }
      });

      await nodeB.rpcRouter.dispatch(
        constructInstallRpc(msg.data.appInstanceId)
      );
    });

    const response = await nodeA.rpcRouter.dispatch(installationProposalRpc);

    const { appInstanceId } = response.result
      .result as CFCoreTypes.ProposeInstallResult;
    return appInstanceId;
  });
}

export async function installVirtualApp(
  nodeA: Node,
  nodeB: Node,
  nodeC: Node,
  appDefinition: string,
  initialState?: SolidityValueType,
  assetId?: string,
  initiatorDeposit?: BigNumber,
  responderDeposit?: BigNumber
): Promise<string> {
  nodeC.on(`PROPOSE_INSTALL_EVENT`, async (msg: ProposeMessage) => {
    const { appInstanceId, params } = await proposal;
    const {
      data: { appInstanceId: eventAppInstanceId }
    } = msg;
    if (eventAppInstanceId === appInstanceId) {
      assertProposeMessage(nodeA.publicIdentifier, msg, params);
      await nodeC.rpcRouter.dispatch(
        constructInstallVirtualRpc(appInstanceId, nodeB.publicIdentifier)
      );
    }
  });

  // await in listener bc event is emitted before
  // promise officially resolves
  const proposal = makeVirtualProposal(
    nodeA,
    nodeC,
    appDefinition,
    initialState,
    assetId,
    initiatorDeposit,
    responderDeposit
  );

  return new Promise((resolve: (appInstanceId: string) => void) =>
    nodeA.on(`INSTALL_VIRTUAL_EVENT`, async (msg: InstallVirtualMessage) => {
      const { appInstanceId } = await proposal;
      if (msg.data.params.appInstanceId === appInstanceId) {
        assertNodeMessage(msg, {
          from: nodeC.publicIdentifier,
          type: `INSTALL_VIRTUAL_EVENT`,
          data: { params: { appInstanceId } }
        });
        resolve(appInstanceId);
      }
    })
  );
}

export async function confirmChannelCreation(
  nodeA: Node,
  nodeB: Node,
  ownersFreeBalanceAddress: string[],
  data: CFCoreTypes.CreateChannelResult
) {
  const openChannelsNodeA = await getChannelAddresses(nodeA);
  const openChannelsNodeB = await getChannelAddresses(nodeB);

  expect(openChannelsNodeA.has(data.multisigAddress)).toBeTruthy();
  expect(openChannelsNodeB.has(data.multisigAddress)).toBeTruthy();
  expect(data.owners.sort()).toEqual(ownersFreeBalanceAddress.sort());
}

export async function confirmAppInstanceInstallation(
  proposedParams: ProposeInstallProtocolParams,
  appInstance: AppInstanceJson
) {
  const params = bigNumberifyJson(proposedParams);
  expect(appInstance.appInterface.addr).toEqual(params.appDefinition);
  expect(appInstance.appInterface.stateEncoding).toEqual(
    params.abiEncodings.stateEncoding
  );
  expect(appInstance.appInterface.actionEncoding).toEqual(
    params.abiEncodings.actionEncoding
  );
  expect(appInstance.defaultTimeout).toEqual(params.timeout.toNumber());
  expect(appInstance.latestState).toEqual(params.initialState);
}

export async function getState(
  nodeA: Node,
  appInstanceId: string
): Promise<SolidityValueType> {
  const getStateReq = constructGetStateRpc(appInstanceId);
  const getStateResult = await nodeA.rpcRouter.dispatch(getStateReq);
  return (getStateResult.result.result as CFCoreTypes.GetStateResult).state;
}

export async function makeVirtualProposal(
  nodeA: Node,
  nodeC: Node,
  appDefinition: string,
  initialState?: SolidityValueType,
  assetId?: string,
  initiatorDeposit?: BigNumber,
  responderDeposit?: BigNumber
): Promise<{
  appInstanceId: string;
  params: ProposeInstallProtocolParams;
}> {
  const appContext = getAppContext(appDefinition, initialState);

  const virtualProposalRpc = constructVirtualProposalRpc(
    nodeC.publicIdentifier,
    appContext.appDefinition,
    appContext.abiEncodings,
    appContext.initialState,
    initiatorDeposit || One,
    assetId || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    responderDeposit || Zero,
    assetId || CONVENTION_FOR_ETH_TOKEN_ADDRESS
  );

  const params = virtualProposalRpc.parameters as ProposeInstallProtocolParams;

  const {
    result: {
      result: { appInstanceId }
    }
  } = await nodeA.rpcRouter.dispatch({
    parameters: params,
    methodName: ProtocolTypes.chan_proposeInstall,
    id: Date.now()
  });

  return { appInstanceId, params };
}

export async function installTTTVirtual(
  node: Node,
  appInstanceId: string,
  intermediaryIdentifier: string
) {
  return await node.rpcRouter.dispatch(
    constructInstallVirtualRpc(appInstanceId, intermediaryIdentifier)
  );
}

export async function makeInstallCall(node: Node, appInstanceId: string) {
  return await node.rpcRouter.dispatch(constructInstallRpc(appInstanceId));
}

export async function makeVirtualProposeCall(
  nodeA: Node,
  nodeC: Node,
  appDefinition: string,
  initialState?: SolidityValueType
): Promise<{
  appInstanceId: string;
  params: CFCoreTypes.ProposeInstallVirtualParams;
}> {
  const appContext = getAppContext(appDefinition, initialState);

  const virtualProposalRpc = constructVirtualProposalRpc(
    nodeC.publicIdentifier,
    appContext.appDefinition,
    appContext.abiEncodings,
    appContext.initialState
  );

  const response = await nodeA.rpcRouter.dispatch(virtualProposalRpc);

  return {
    appInstanceId: (response.result as CFCoreTypes.ProposeInstallVirtualResult)
      .appInstanceId,
    params: virtualProposalRpc.parameters as CFCoreTypes.ProposeInstallVirtualParams
  };
}

export function makeProposeCall(
  nodeB: Node,
  appDefinition: string,
  initialState?: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  responderDeposit: BigNumber = Zero,
  responderDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS
): Rpc {
  const appContext = getAppContext(appDefinition, initialState);
  return constructAppProposalRpc(
    nodeB.publicIdentifier,
    appContext.appDefinition,
    appContext.abiEncodings,
    appContext.initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDeposit,
    responderDepositTokenAddress
  );
}

export async function makeAndSendProposeCall(
  nodeA: Node,
  nodeB: Node,
  appDefinition: string,
  initialState?: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  responderDeposit: BigNumber = Zero,
  responderDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS
): Promise<{
  appInstanceId: string;
  params: ProposeInstallProtocolParams;
}> {
  const installationProposalRpc = makeProposeCall(
    nodeB,
    appDefinition,
    initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDeposit,
    responderDepositTokenAddress
  );

  const {
    result: {
      result: { appInstanceId }
    }
  } = await nodeA.rpcRouter.dispatch(installationProposalRpc);

  return {
    appInstanceId,
    params: installationProposalRpc.parameters as ProposeInstallProtocolParams
  };
}

/**
 * @return the ERC20 token balance of the receiver
 */
export async function transferERC20Tokens(
  toAddress: string,
  tokenAddress: string = global[`networkContext`][`DolphinCoin`],
  contractABI: ContractABI = DolphinCoin.abi,
  amount: BigNumber = One
): Promise<BigNumber> {
  const deployerAccount = new Wallet(
    global[`fundedPrivateKey`],
    new JsonRpcProvider(global[`ganacheURL`])
  );

  const contract = new Contract(tokenAddress, contractABI, deployerAccount);

  const balanceBefore: BigNumber = await contract.functions.balanceOf(
    toAddress
  );

  await contract.functions.transfer(toAddress, amount);
  const balanceAfter: BigNumber = await contract.functions.balanceOf(toAddress);

  expect(balanceAfter.sub(balanceBefore)).toEqual(amount);

  return balanceAfter;
}

export function getAppContext(
  appDefinition: string,
  initialState?: SolidityValueType,
  senderAddress?: string, // needed for both types of transfer apps
  receiverAddress?: string // needed for both types of transfer apps
): AppContext {
  const checkForAddresses = () => {
    const missingAddr = !senderAddress || !receiverAddress;
    if (missingAddr && !initialState) {
      throw new Error(
        `Must have sender and redeemer addresses to generate initial state for either transfer app context`
      );
    }
  };

  switch (appDefinition) {
  case TicTacToeApp:
    return {
      appDefinition,
      abiEncodings: tttAbiEncodings,
      initialState: initialState || initialEmptyTTTState(),
      outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME
    };

  case UnidirectionalTransferApp:
    checkForAddresses();
    return {
      appDefinition,
      initialState:
          initialState ||
          initialTransferState(senderAddress!, receiverAddress!),
      abiEncodings: transferAbiEncodings,
      outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER
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
      outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER
    };

  case SimpleTransferApp:
    checkForAddresses();
    return {
      appDefinition,
      initialState:
          initialState ||
          initialSimpleTransferState(senderAddress!, receiverAddress!),
      abiEncodings: simpleTransferAbiEncodings,
      outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER
    };

  default:
    throw new Error(
      `Proposing the specified app is not supported: ${appDefinition}`
    );
  }
}

export async function uninstallVirtualApp(
  node: Node,
  counterparty: Node,
  intermediaryPubId: string,
  appId: string
): Promise<string> {
  const rpc = constructUninstallVirtualRpc(appId, intermediaryPubId);
  return new Promise(async resolve => {
    counterparty.once(
      `UNINSTALL_VIRTUAL_EVENT`,
      (msg: UninstallVirtualMessage) => {
        resolve(msg.data.appInstanceId);
      }
    );
    await node.rpcRouter.dispatch(rpc);
  });
}

export async function takeAppAction(node: Node, appId: string, action: any) {
  const res = await node.rpcRouter.dispatch(
    constructTakeActionRpc(appId, action)
  );
  return res.result.result;
}

export function uninstallApp(
  node: Node,
  counterparty: Node,
  appId: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    counterparty.once(UNINSTALL_EVENT, (msg: UninstallMessage) => {
      resolve(msg.data.appInstanceId);
    });
    try {
      await node.rpcRouter.dispatch(constructUninstallRpc(appId));
    } catch (e) {
      return reject(e.message);
    }
  });
}

export async function getApps(node: Node): Promise<AppInstanceJson[]> {
  return (await node.rpcRouter.dispatch(constructGetAppsRpc())).result.result
    .appInstances;
}

export async function getBalances(
  nodeA: Node,
  nodeB: Node,
  multisigAddress: string,
  tokenAddress: string
): Promise<[BigNumber, BigNumber]> {
  let tokenFreeBalanceState = await getFreeBalanceState(
    nodeA,
    multisigAddress,
    tokenAddress
  );

  const tokenBalanceNodeA =
    tokenFreeBalanceState[xkeyKthAddress(nodeA.publicIdentifier, 0)];

  tokenFreeBalanceState = await getFreeBalanceState(
    nodeB,
    multisigAddress,
    tokenAddress
  );

  const tokenBalanceNodeB =
    tokenFreeBalanceState[xkeyKthAddress(nodeB.publicIdentifier, 0)];

  return [tokenBalanceNodeA, tokenBalanceNodeB];
}
