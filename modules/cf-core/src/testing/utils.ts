import {
  AppABIEncodings,
  AppInstanceJson,
  AppInstanceProposal,
  ContractABI,
  CreateChannelMessage,
  EventNames,
  InstallMessage,
  MethodNames,
  MethodParams,
  MethodParam,
  MethodResults,
  OutcomeType,
  ProposeMessage,
  ProtocolParams,
  SolidityValueType,
  UninstallMessage,
} from "@connext/types";
import { Contract, Wallet } from "ethers";
import { AddressZero, One, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { BigNumber, bigNumberify, getAddress, hexlify, randomBytes } from "ethers/utils";
import { JsonRpcResponse, Rpc } from "rpc-server";

import { Node } from "../node";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../constants";
import { AppInstance, StateChannel } from "../models";
import { computeRandomExtendedPrvKey, xkeyKthAddress, xkeysToSortedKthAddresses } from "../xkeys";
import {
  DepositConfirmationMessage,
  DepositStartedMessage,
  EventEmittedMessage,
} from "../types";
import { deBigNumberifyJson, bigNumberifyJson } from "../utils";

import { DolphinCoin, NetworkContextForTestSuite } from "./contracts";
import { initialLinkedState, linkedAbiEncodings } from "./linked-transfer";
import { initialSimpleTransferState, simpleTransferAbiEncodings } from "./simple-transfer";
import { initialEmptyTTTState, tttAbiEncodings } from "./tic-tac-toe";
import { initialTransferState, transferAbiEncodings } from "./unidirectional-transfer";

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
  UnidirectionalTransferApp,
} = global[`networkContext`] as NetworkContextForTestSuite;

export function createAppInstanceProposalForTest(appInstanceId: string): AppInstanceProposal {
  return {
    identityHash: appInstanceId,
    proposedByIdentifier: computeRandomExtendedPrvKey(),
    proposedToIdentifier: computeRandomExtendedPrvKey(),
    appDefinition: AddressZero,
    abiEncodings: {
      stateEncoding: "tuple(address foo, uint256 bar)",
      actionEncoding: undefined,
    } as AppABIEncodings,
    initiatorDeposit: "0x00",
    responderDeposit: "0x00",
    timeout: "0x01",
    initialState: {
      foo: AddressZero,
      bar: 0,
    } as SolidityValueType,
    appSeqNo: 0,
    outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
    initiatorDepositTokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    responderDepositTokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  };
}

export function createAppInstanceForTest(stateChannel?: StateChannel) {
  return new AppInstance(
    /* participants */ stateChannel
      ? stateChannel.getSigningKeysFor(stateChannel.numProposedApps)
      : [getAddress(hexlify(randomBytes(20))), getAddress(hexlify(randomBytes(20)))],
    /* defaultTimeout */ 0,
    /* appInterface */ {
      addr: getAddress(hexlify(randomBytes(20))),
      stateEncoding: "tuple(address foo, uint256 bar)",
      actionEncoding: undefined,
    },
    /* appSeqNo */ stateChannel ? stateChannel.numProposedApps : Math.ceil(1000 * Math.random()),
    /* latestState */ { foo: AddressZero, bar: bigNumberify(0) },
    /* latestVersionNumber */ 0,
    /* latestTimeout */ Math.ceil(1000 * Math.random()),
    /* outcomeType */ OutcomeType.TWO_PARTY_FIXED_OUTCOME,
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
  node: Node,
  multisigAddress: string,
  tokenAddress: string = AddressZero,
) {
  return await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: MethodNames.chan_requestDepositRights,
    parameters: {
      multisigAddress,
      tokenAddress,
    } as MethodParams.RequestDepositRights,
  });
}

export async function rescindDepositRights(
  node: Node,
  multisigAddress: string,
  tokenAddress: string = AddressZero,
) {
  return await node.rpcRouter.dispatch(
    constructRescindDepositRightsRpcCall(multisigAddress, tokenAddress),
  );
}

export function constructRescindDepositRightsRpcCall(
  multisigAddress: string,
  tokenAddress: string = AddressZero,
) {
  return {
    id: Date.now(),
    methodName: MethodNames.chan_rescindDepositRights,
    parameters: {
      multisigAddress,
      tokenAddress,
    },
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
  shouldExist: string[] = [],
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
  params: ProtocolParams.Propose,
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
          proposedToIdentifier,
        },
      },
    },
    [`data.appInstanceId`],
  );
}

export function assertInstallMessage(senderId: string, msg: InstallMessage, appInstanceId: string) {
  assertNodeMessage(msg, {
    from: senderId,
    type: `INSTALL_EVENT`,
    data: {
      params: {
        appInstanceId,
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
export async function getMultisigCreationAddress(node: Node, xpubs: string[]): Promise<string> {
  const {
    result: {
      result: { multisigAddress },
    },
  } = await node.rpcRouter.dispatch(constructChannelCreationRpc(xpubs));
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

export async function getAppInstance(node: Node, appInstanceId: string): Promise<AppInstanceJson> {
  const {
    result: {
      result: { appInstance },
    },
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: MethodNames.chan_getAppInstance,
    parameters: {
      appInstanceId,
    },
  });

  return appInstance;
}

export async function getAppInstanceProposal(
  node: Node,
  appInstanceId: string,
  multisigAddress: string,
): Promise<AppInstanceProposal> {
  const candidates = (await getProposedAppInstances(node, multisigAddress)).filter(
    proposal => proposal.identityHash === appInstanceId,
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
  tokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
): Promise<MethodResults.GetFreeBalanceState> {
  const {
    result: { result },
  } = await node.rpcRouter.dispatch({
    id: Date.now(),
    methodName: MethodNames.chan_getFreeBalanceState,
    parameters: {
      multisigAddress,
      tokenAddress,
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

export async function getProposeCoinBalanceRefundAppParams(
  multisigAddress: string,
  balanceRefundRecipientIdentifer: string,
  proposedToIdentifier: string,
  tokenAddress: string = AddressZero,
): Promise<MethodParams.ProposeInstall> {
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
      stateEncoding: `tuple(address recipient, address multisig, uint256 threshold, address tokenAddress)`,
    },
    appDefinition: CoinBalanceRefundApp,
    initialState: {
      multisig: multisigAddress,
      recipient: xkeyKthAddress(balanceRefundRecipientIdentifer, 0),
      threshold: threshold.toString(),
      tokenAddress,
    },
    initiatorDeposit: Zero,
    initiatorDepositTokenAddress: tokenAddress,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    proposedToIdentifier,
    responderDeposit: Zero,
    responderDepositTokenAddress: tokenAddress,
    timeout: Zero,
  };
}

export async function deposit(
  node: Node,
  multisigAddress: string,
  amount: BigNumber = One,
  proposedToNode: Node,
  tokenAddress?: string,
) {
  const proposeParams = await getProposeCoinBalanceRefundAppParams(
    multisigAddress,
    node.publicIdentifier,
    proposedToNode.publicIdentifier,
    tokenAddress,
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
      methodName: MethodNames.chan_proposeInstall,
      parameters: proposeParams,
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
          tokenAddress: tokenAddress || AddressZero,
        },
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
            value: amount,
          },
        },
        [`data.txHash`],
      );
    });

    // TODO: how to test deposit failed events?
    await node.rpcRouter.dispatch(depositReq);
  });
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

export function constructDepositRpc(
  multisigAddress: string,
  amount: BigNumber,
  tokenAddress?: string,
): Rpc {
  return {
    id: Date.now(),
    methodName: MethodNames.chan_deposit,
    parameters: deBigNumberifyJson({
      multisigAddress,
      amount,
      tokenAddress,
    }),
  };
}

export function constructWithdrawCommitmentRpc(
  multisigAddress: string,
  amount: BigNumber,
  tokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  recipient?: string,
): Rpc {
  const withdrawCommitmentReq = constructWithdrawRpc(
    multisigAddress,
    amount,
    tokenAddress,
    recipient,
  );

  withdrawCommitmentReq.methodName = MethodNames.chan_withdrawCommitment;

  return withdrawCommitmentReq;
}

export function constructWithdrawRpc(
  multisigAddress: string,
  amount: BigNumber,
  tokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  recipient?: string,
): Rpc {
  return {
    id: Date.now(),
    methodName: MethodNames.chan_withdraw,
    parameters: deBigNumberifyJson({
      tokenAddress,
      multisigAddress,
      amount,
      recipient,
    }) as MethodParams.Withdraw,
  };
}

export function constructInstallRpc(appInstanceId: string): Rpc {
  return {
    id: Date.now(),
    methodName: MethodNames.chan_install,
    parameters: {
      appInstanceId,
    } as MethodParams.Install,
  };
}

export function constructRejectInstallRpc(appInstanceId: string): Rpc {
  return {
    id: Date.now(),
    methodName: MethodNames.chan_rejectInstall,
    parameters: {
      appInstanceId,
    } as MethodParams.RejectInstall,
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
  responderDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
): Rpc {
  const { outcomeType } = getAppContext(appDefinition, initialState);
  return {
    id: Date.now(),
    methodName: MethodNames.chan_proposeInstall,
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
      timeout: One,
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

  expect(proposalParams.timeout).toEqual(bigNumberify(appInstanceProposal.timeout));

  // TODO: uncomment when getState is implemented
  // expect(proposalParams.initialState).toEqual(appInstanceInitialState);
}

export function constructGetStateRpc(appInstanceId: string): Rpc {
  return {
    parameters: {
      appInstanceId,
    },
    id: Date.now(),
    methodName: MethodNames.chan_getState,
  };
}

export function constructTakeActionRpc(appInstanceId: string, action: any): Rpc {
  return {
    parameters: deBigNumberifyJson({
      appInstanceId,
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

export function constructUninstallRpc(appInstanceId: string): Rpc {
  return {
    parameters: {
      appInstanceId,
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
  tokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  collateralizeNode2: boolean = true,
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
      0,
    );

    nodeB.once(EventNames.CREATE_CHANNEL_EVENT, async (msg: CreateChannelMessage) => {
      assertNodeMessage(
        msg,
        {
          from: nodeA.publicIdentifier,
          type: EventNames.CREATE_CHANNEL_EVENT,
          data: {
            owners: sortedOwners,
            counterpartyXpub: nodeA.publicIdentifier,
          },
        },
        [`data.multisigAddress`],
      );
      expect(await getInstalledAppInstances(nodeB, msg.data.multisigAddress)).toEqual([]);
      resolve(msg.data.multisigAddress);
    });

    nodeA.once(EventNames.CREATE_CHANNEL_EVENT, (msg: CreateChannelMessage) => {
      assertNodeMessage(
        msg,
        {
          from: nodeA.publicIdentifier,
          type: EventNames.CREATE_CHANNEL_EVENT,
          data: {
            owners: sortedOwners,
            counterpartyXpub: nodeB.publicIdentifier,
          },
        },
        [`data.multisigAddress`],
      );
    });

    // trigger channel creation but only resolve with the multisig address
    // as acknowledged by the node
    const multisigAddress = await getMultisigCreationAddress(nodeA, [
      nodeA.publicIdentifier,
      nodeB.publicIdentifier,
    ]);

    expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
  });
}

// NOTE: Do not run this concurrently, it won't work
export async function installApp(
  nodeA: Node,
  nodeB: Node,
  multisigAddress: string,
  appDefinition: string,
  initialState?: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  responderDeposit: BigNumber = Zero,
  responderDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
): Promise<[string, ProtocolParams.Propose]> {
  const appContext = getAppContext(appDefinition, initialState);

  const installationProposalRpc = constructAppProposalRpc(
    nodeB.publicIdentifier,
    appContext.appDefinition,
    appContext.abiEncodings,
    appContext.initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDeposit,
    responderDepositTokenAddress,
  );

  const proposedParams = installationProposalRpc.parameters as ProtocolParams.Propose;

  return new Promise(async resolve => {
    nodeB.once(`PROPOSE_INSTALL_EVENT`, async (msg: ProposeMessage) => {
      // assert message
      assertProposeMessage(nodeA.publicIdentifier, msg, proposedParams);

      const {
        data: { appInstanceId },
      } = msg;

      // Sanity-check
      confirmProposedAppInstance(
        installationProposalRpc.parameters,
        await getAppInstanceProposal(nodeA, appInstanceId, multisigAddress),
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

      await nodeB.rpcRouter.dispatch(constructInstallRpc(msg.data.appInstanceId));
    });

    const response = await nodeA.rpcRouter.dispatch(installationProposalRpc);

    const { appInstanceId } = response.result.result as MethodResults.ProposeInstall;
    return appInstanceId;
  });
}

export async function confirmChannelCreation(
  nodeA: Node,
  nodeB: Node,
  ownersFreeBalanceAddress: string[],
  data: MethodResults.CreateChannel,
) {
  const openChannelsNodeA = await getChannelAddresses(nodeA);
  const openChannelsNodeB = await getChannelAddresses(nodeB);

  expect(openChannelsNodeA.has(data.multisigAddress)).toBeTruthy();
  expect(openChannelsNodeB.has(data.multisigAddress)).toBeTruthy();
  expect(data.owners!.sort()).toEqual(ownersFreeBalanceAddress.sort());
}

export async function confirmAppInstanceInstallation(
  proposedParams: ProtocolParams.Propose,
  appInstance: AppInstanceJson,
) {
  const params = bigNumberifyJson(proposedParams);
  expect(appInstance.appInterface.addr).toEqual(params.appDefinition);
  expect(appInstance.appInterface.stateEncoding).toEqual(params.abiEncodings.stateEncoding);
  expect(appInstance.appInterface.actionEncoding).toEqual(params.abiEncodings.actionEncoding);
  expect(appInstance.defaultTimeout).toEqual(params.timeout.toNumber());
  expect(appInstance.latestState).toEqual(params.initialState);
}

export async function getState(nodeA: Node, appInstanceId: string): Promise<SolidityValueType> {
  const getStateReq = constructGetStateRpc(appInstanceId);
  const getStateResult = await nodeA.rpcRouter.dispatch(getStateReq);
  return (getStateResult.result.result as MethodResults.GetState).state;
}

export async function makeInstallCall(node: Node, appInstanceId: string) {
  return await node.rpcRouter.dispatch(constructInstallRpc(appInstanceId));
}

export function makeProposeCall(
  nodeB: Node,
  appDefinition: string,
  initialState?: SolidityValueType,
  initiatorDeposit: BigNumber = Zero,
  initiatorDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
  responderDeposit: BigNumber = Zero,
  responderDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
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
    responderDepositTokenAddress,
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
  responderDepositTokenAddress: string = CONVENTION_FOR_ETH_TOKEN_ADDRESS,
): Promise<{
  appInstanceId: string;
  params: ProtocolParams.Propose;
}> {
  const installationProposalRpc = makeProposeCall(
    nodeB,
    appDefinition,
    initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDeposit,
    responderDepositTokenAddress,
  );

  const {
    result: {
      result: { appInstanceId },
    },
  } = await nodeA.rpcRouter.dispatch(installationProposalRpc);

  return {
    appInstanceId,
    params: installationProposalRpc.parameters as ProtocolParams.Propose,
  };
}

/**
 * @return the ERC20 token balance of the receiver
 */
export async function transferERC20Tokens(
  toAddress: string,
  tokenAddress: string = global[`networkContext`][`DolphinCoin`],
  contractABI: ContractABI = DolphinCoin.abi,
  amount: BigNumber = One,
): Promise<BigNumber> {
  const deployerAccount = new Wallet(
    global[`fundedPrivateKey`],
    new JsonRpcProvider(global[`ganacheURL`]),
  );

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

    default:
      throw new Error(`Proposing the specified app is not supported: ${appDefinition}`);
  }
}

export async function takeAppAction(node: Node, appId: string, action: any) {
  const res = await node.rpcRouter.dispatch(constructTakeActionRpc(appId, action));
  return res.result.result;
}

export function uninstallApp(node: Node, counterparty: Node, appId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    counterparty.once(EventNames.UNINSTALL_EVENT, (msg: UninstallMessage) => {
      resolve(msg.data.appInstanceId);
    });
    try {
      await node.rpcRouter.dispatch(constructUninstallRpc(appId));
    } catch (e) {
      return reject(e.message);
    }
  });
}

export async function getApps(node: Node, multisigAddress: string): Promise<AppInstanceJson[]> {
  return (await node.rpcRouter.dispatch(constructGetAppsRpc(multisigAddress))).result.result
    .appInstances;
}

export async function getBalances(
  nodeA: Node,
  nodeB: Node,
  multisigAddress: string,
  tokenAddress: string,
): Promise<[BigNumber, BigNumber]> {
  let tokenFreeBalanceState = await getFreeBalanceState(nodeA, multisigAddress, tokenAddress);

  const tokenBalanceNodeA = tokenFreeBalanceState[xkeyKthAddress(nodeA.publicIdentifier, 0)];

  tokenFreeBalanceState = await getFreeBalanceState(nodeB, multisigAddress, tokenAddress);

  const tokenBalanceNodeB = tokenFreeBalanceState[xkeyKthAddress(nodeB.publicIdentifier, 0)];

  return [tokenBalanceNodeA, tokenBalanceNodeB];
}
