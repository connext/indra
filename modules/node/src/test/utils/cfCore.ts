import {
  AppInstanceJson,
  ChallengeStatus,
  ChallengeUpdatedEventPayload,
  ConditionalTransactionCommitmentJSON,
  ContractAddresses,
  MinimalTransaction,
  OutcomeType,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StateProgressedEventPayload,
  StoredAppChallenge,
  StoredAppChallengeStatus,
  SingleAssetTwoPartyCoinTransferInterpreterParamsJson,
  StateSchemaVersion,
} from "@connext/types";
import {
  deBigNumberifyJson,
  getRandomAddress,
  getRandomBytes32,
  getRandomIdentifier,
  getRandomSignature,
  toBNJson,
} from "@connext/utils";
import { constants, utils } from "ethers";

import { CFCoreStore } from "../../cfCore/cfCore.store";

import { env } from "./config";

const { AddressZero, HashZero, Zero, One } = constants;
const { defaultAbiCoder } = utils;

export const createAppInstanceJson = (
  overrides: Partial<AppInstanceJson> = {},
): AppInstanceJson => {
  return {
    abiEncodings: {
      actionEncoding: `uint256`,
      stateEncoding: "uint256",
    },
    appDefinition: AddressZero,
    appSeqNo: 0,
    defaultTimeout: Zero.toHexString(),
    identityHash: getRandomBytes32(),
    initiatorIdentifier: getRandomIdentifier(),
    responderIdentifier: getRandomIdentifier(),
    latestState: {},
    latestVersionNumber: 0,
    multisigAddress: getRandomAddress(),
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    outcomeInterpreterParameters: {
      limit: { _hex: Zero.toHexString(), _isBigNumber: true },
      tokenAddress: AddressZero,
    } as SingleAssetTwoPartyCoinTransferInterpreterParamsJson,
    initiatorDeposit: Zero.toString(),
    initiatorDepositAssetId: AddressZero,
    responderDeposit: Zero.toString(),
    responderDepositAssetId: AddressZero,
    stateTimeout: Zero.toHexString(),
    meta: null,
    ...overrides,
  };
};

export const createStateChannelJSON = (
  overrides: Partial<StateChannelJSON> = {},
): StateChannelJSON => {
  const userIdentifiers = overrides.userIdentifiers || [getRandomAddress(), getRandomAddress()];
  const channelData: Omit<StateChannelJSON, "freeBalanceAppInstance"> = {
    addresses: {
      MinimumViableMultisig: getRandomAddress(),
      ProxyFactory: getRandomAddress(),
    },
    appInstances: [],
    chainId: env.defaultChain,
    monotonicNumProposedApps: 0,
    multisigAddress: getRandomAddress(),
    proposedAppInstances: [],
    schemaVersion: StateSchemaVersion,
    userIdentifiers,
    ...overrides,
  };

  return {
    ...channelData,
    freeBalanceAppInstance: createAppInstanceJson({
      initiatorIdentifier: channelData.userIdentifiers[0],
      multisigAddress: channelData.multisigAddress,
      responderIdentifier: channelData.userIdentifiers[1],
      meta: null,
      ...overrides.freeBalanceAppInstance,
    }),
  };
};

export const createSetStateCommitmentJSON = (
  overrides: Partial<SetStateCommitmentJSON> = {},
): SetStateCommitmentJSON => {
  return deBigNumberifyJson<SetStateCommitmentJSON>({
    appIdentity: {
      channelNonce: Zero,
      participants: [getRandomAddress(), getRandomAddress()],
      multisigAddress: getRandomAddress(),
      appDefinition: AddressZero,
      defaultTimeout: Zero,
    },
    appIdentityHash: getRandomBytes32(),
    appStateHash: getRandomBytes32(),
    challengeRegistryAddress: AddressZero,
    signatures: [getRandomSignature(), getRandomSignature()],
    stateTimeout: Zero,
    versionNumber: Zero,
    transactionData: getRandomBytes32(),
    ...overrides,
  });
};

const getContractAddresses = (overrides: Partial<ContractAddresses> = {}): ContractAddresses => {
  return {
    ProxyFactory: getRandomAddress(),
    MinimumViableMultisig: getRandomAddress(),
    ChallengeRegistry: getRandomAddress(),
    ConditionalTransactionDelegateTarget: getRandomAddress(),
    DepositApp: getRandomAddress(),
    WithdrawApp: getRandomAddress(),
    HashLockTransferApp: getRandomAddress(),
    IdentityApp: getRandomAddress(),
    MultiAssetMultiPartyCoinTransferInterpreter: getRandomAddress(),
    GraphSignedTransferApp: getRandomAddress(),
    SimpleLinkedTransferApp: getRandomAddress(),
    SimpleSignedTransferApp: getRandomAddress(),
    SimpleTwoPartySwapApp: getRandomAddress(),
    SingleAssetTwoPartyCoinTransferInterpreter: getRandomAddress(),
    TimeLockedPassThrough: getRandomAddress(),
    Token: getRandomAddress(),
    TwoPartyFixedOutcomeInterpreter: getRandomAddress(),
    WithdrawInterpreter: getRandomAddress(),
    ...overrides,
  };
};

export const createConditionalTransactionCommitmentJSON = (
  overrides: Partial<ConditionalTransactionCommitmentJSON> = {},
): ConditionalTransactionCommitmentJSON => {
  return {
    appIdentityHash: getRandomBytes32(),
    freeBalanceAppIdentityHash: getRandomBytes32(),
    interpreterAddr: AddressZero,
    interpreterParams: "",
    multisigAddress: getRandomAddress(),
    multisigOwners: [getRandomAddress(), getRandomAddress()],
    contractAddresses: getContractAddresses(),
    signatures: [getRandomSignature(), getRandomSignature()],
    transactionData: getRandomBytes32(),
    ...overrides,
  };
};

export const createMinimalTransaction = (
  overrides: Partial<MinimalTransaction> = {},
): MinimalTransaction => {
  return {
    data: HashZero,
    to: AddressZero,
    value: Zero,
    ...overrides,
  };
};

export const createStoredAppChallenge = (
  overrides: Partial<StoredAppChallenge> = {},
): StoredAppChallenge => {
  return {
    identityHash: getRandomBytes32(),
    appStateHash: getRandomBytes32(),
    versionNumber: One,
    finalizesAt: Zero,
    status: StoredAppChallengeStatus.IN_DISPUTE,
    chainId: env.defaultChain,
    ...overrides,
  };
};

export const createStateProgressedEventPayload = (
  overrides: Partial<StateProgressedEventPayload> = {},
): StateProgressedEventPayload => {
  return {
    identityHash: getRandomBytes32(),
    action: defaultAbiCoder.encode(["uint256"], [One]),
    versionNumber: One,
    timeout: Zero,
    turnTaker: getRandomAddress(),
    signature: getRandomAddress(),
    chainId: env.defaultChain,
    ...overrides,
  };
};

export const createChallengeUpdatedEventPayload = (
  overrides: Partial<ChallengeUpdatedEventPayload> = {},
): ChallengeUpdatedEventPayload => {
  return {
    identityHash: getRandomBytes32(),
    appStateHash: getRandomBytes32(),
    versionNumber: One,
    finalizesAt: Zero,
    status: ChallengeStatus.IN_DISPUTE,
    chainId: env.defaultChain,
    ...overrides,
  };
};

export const createTestStateChannelJSONs = (
  nodeIdentifier: string,
  userIdentifier: string = getRandomIdentifier(),
  multisigAddress: string = getRandomAddress(),
) => {
  const channelJson = createStateChannelJSON({
    multisigAddress,
    userIdentifiers: [nodeIdentifier, userIdentifier],
  });
  const setupCommitment = createMinimalTransaction();
  const freeBalanceUpdate = createSetStateCommitmentJSON({
    appIdentityHash: channelJson.freeBalanceAppInstance!.identityHash,
  });
  return { channelJson, setupCommitment, freeBalanceUpdate };
};

export const createTestChannel = async (
  cfCoreStore: CFCoreStore,
  nodeIdentifier: string,
  userIdentifier: string = getRandomIdentifier(),
  multisigAddress: string = getRandomAddress(),
) => {
  const { channelJson, setupCommitment, freeBalanceUpdate } = createTestStateChannelJSONs(
    nodeIdentifier,
    userIdentifier,
    multisigAddress,
  );
  await cfCoreStore.createStateChannel(channelJson, setupCommitment, freeBalanceUpdate);

  return { multisigAddress, userIdentifier, channelJson, setupCommitment, freeBalanceUpdate };
};

export const createTestChannelWithAppInstance = async (
  cfCoreStore: CFCoreStore,
  nodeIdentifier: string,
  userIdentifier: string = getRandomIdentifier(),
  multisigAddress: string = getRandomAddress(),
) => {
  const { channelJson } = await createTestChannel(
    cfCoreStore,
    nodeIdentifier,
    userIdentifier,
    multisigAddress,
  );

  const appProposal = createAppInstanceJson({
    appSeqNo: 2,
    initiatorIdentifier: userIdentifier,
    responderIdentifier: nodeIdentifier,
    multisigAddress,
  });
  const setStateCommitment = createSetStateCommitmentJSON({
    appIdentityHash: appProposal.identityHash,
  });
  const conditionalCommitment = createConditionalTransactionCommitmentJSON({
    appIdentityHash: appProposal.identityHash,
  });
  await cfCoreStore.createAppProposal(
    multisigAddress,
    appProposal,
    2,
    setStateCommitment,
    conditionalCommitment,
  );

  const appInstance = createAppInstanceJson({
    identityHash: appProposal.identityHash,
    multisigAddress,
    initiatorIdentifier: userIdentifier,
    responderIdentifier: nodeIdentifier,
    appSeqNo: appProposal.appSeqNo,
  });
  const updatedFreeBalance: AppInstanceJson = {
    ...channelJson.freeBalanceAppInstance!,
    latestState: { appState: "updated" },
  };
  const freeBalanceUpdateCommitment = createSetStateCommitmentJSON({
    appIdentityHash: channelJson.freeBalanceAppInstance!.identityHash,
    versionNumber: toBNJson(100),
  });
  await cfCoreStore.createAppInstance(
    multisigAddress,
    appInstance,
    updatedFreeBalance,
    freeBalanceUpdateCommitment,
  );

  return {
    multisigAddress,
    userIdentifier,
    channelJson,
    appInstance,
    updatedFreeBalance,
    conditionalCommitment,
    freeBalanceUpdateCommitment,
  };
};

export const createTestChallengeWithAppInstanceAndChannel = async (
  cfCoreStore: CFCoreStore,
  nodeIdentifier: string,
  userIdentifierParam: string = getRandomAddress(),
  multisigAddressParam: string = getRandomAddress(),
) => {
  const {
    multisigAddress,
    userIdentifier,
    channelJson,
    appInstance,
    updatedFreeBalance,
  } = await createTestChannelWithAppInstance(
    cfCoreStore,
    nodeIdentifier,
    userIdentifierParam,
    multisigAddressParam,
  );

  // add challenge
  const challenge = createStoredAppChallenge({
    identityHash: appInstance.identityHash,
  });
  await cfCoreStore.saveAppChallenge(challenge);

  return {
    challenge,
    multisigAddress,
    userIdentifier,
    channelJson,
    appInstance,
    updatedFreeBalance,
  };
};
