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
} from "@connext/types";
import {
  deBigNumberifyJson,
  getRandomAddress,
  getRandomBytes32,
  getRandomIdentifier,
  getRandomSignature,
  toBN,
} from "@connext/utils";
import { constants } from "ethers";

const { AddressZero, HashZero, Zero, One } = constants;

export const createAppInstanceJson = (
  overrides: Partial<AppInstanceJson> = {},
): AppInstanceJson => {
  return {
    abiEncodings: {
      actionEncoding: null,
      stateEncoding: "",
    },
    appDefinition: AddressZero,
    appSeqNo: 0,
    defaultTimeout: Zero.toHexString(),
    identityHash: getRandomBytes32(),
    initiatorIdentifier: getRandomIdentifier(),
    latestState: {},
    latestVersionNumber: 0,
    multisigAddress: getRandomAddress(),
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    responderIdentifier: getRandomIdentifier(),
    interpreterParams: {} as any,
    initiatorDeposit: Zero.toString(),
    initiatorDepositAssetId: AddressZero,
    responderDeposit: Zero.toString(),
    responderDepositAssetId: AddressZero,
    ...overrides,
  };
};

export const createStateChannelJSON = (
  overrides: Partial<StateChannelJSON> = {},
): StateChannelJSON => {
  const userIdentifiers = [getRandomAddress(), getRandomAddress()];
  const channelData: Omit<StateChannelJSON, "freeBalanceAppInstance"> = {
    addresses: {
      MinimumViableMultisig: "",
      ProxyFactory: "",
    },
    appInstances: [],
    monotonicNumProposedApps: 0,
    multisigAddress: getRandomAddress(),
    proposedAppInstances: [],
    schemaVersion: 1,
    userIdentifiers,
    ...overrides,
  };

  return {
    ...channelData,
    freeBalanceAppInstance: createAppInstanceJson({
      initiatorIdentifier: channelData.userIdentifiers[0],
      multisigAddress: channelData.multisigAddress,
      responderIdentifier: channelData.userIdentifiers[1],
      ...overrides.freeBalanceAppInstance,
    }),
  };
};

export const createSetStateCommitmentJSON = (
  overrides: Partial<SetStateCommitmentJSON> = {},
): SetStateCommitmentJSON => {
  return deBigNumberifyJson({
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
    ...overrides,
  });
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
    contractAddresses: {} as ContractAddresses,
    signatures: [getRandomSignature(), getRandomSignature()],
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
    ...overrides,
  };
};

export const createStateProgressedEventPayload = (
  overrides: Partial<StateProgressedEventPayload> = {},
): StateProgressedEventPayload => {
  return {
    identityHash: getRandomBytes32(),
    action: "0x",
    versionNumber: One,
    timeout: Zero,
    turnTaker: getRandomAddress(),
    signature: getRandomAddress(),
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
    ...overrides,
  };
};
