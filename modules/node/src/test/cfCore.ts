import {
  AppInstanceJson,
  AppInstanceProposal,
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
import { deBigNumberifyJson, getRandomBytes32, getRandomAddress, getRandomChannelSigner } from "@connext/utils";
import { AddressZero, HashZero, Zero, One } from "ethers/constants";
import { Wallet } from "ethers";
import { hexlify, bigNumberify } from "ethers/utils";
import { randomBytes } from "crypto";

export const generateRandomAddress = () => Wallet.createRandom().address;

export const generateRandomIdentifier = () => getRandomChannelSigner().publicIdentifier;

export const generateRandomBytes32 = () => hexlify(randomBytes(32));

export const generateRandomSignature = () => hexlify(randomBytes(65));

export const createAppInstanceJson = (
  overrides: Partial<AppInstanceJson> = {},
): AppInstanceJson => {
  return {
    appInterface: {
      actionEncoding: null,
      addr: AddressZero,
      stateEncoding: "",
    },
    appSeqNo: 0,
    defaultTimeout: Zero.toHexString(),
    identityHash: generateRandomBytes32(),
    latestState: {},
    stateTimeout: bigNumberify(1000).toHexString(),
    latestVersionNumber: 0,
    multisigAddress: generateRandomAddress(),
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    initiatorIdentifier: generateRandomIdentifier(),
    responderIdentifier: generateRandomIdentifier(),
    multiAssetMultiPartyCoinTransferInterpreterParams: null,
    singleAssetTwoPartyCoinTransferInterpreterParams: null,
    twoPartyOutcomeInterpreterParams: null,
    ...overrides,
  };
};

export const createAppInstanceProposal = (
  overrides: Partial<AppInstanceProposal> = {},
): AppInstanceProposal => {
  return {
    appDefinition: AddressZero,
    appSeqNo: 0,
    identityHash: generateRandomBytes32(),
    abiEncodings: {
      actionEncoding: "",
      stateEncoding: "",
    },
    initialState: {},
    initiatorDeposit: "0x00",
    initiatorDepositAssetId: AddressZero,
    initiatorIdentifier: generateRandomIdentifier(),
    responderIdentifier: generateRandomIdentifier(),
    responderDeposit: "0x00",
    responderDepositAssetId: AddressZero,
    defaultTimeout: "0x00",
    stateTimeout: "0x00",
    multiAssetMultiPartyCoinTransferInterpreterParams: undefined,
    singleAssetTwoPartyCoinTransferInterpreterParams: null,
    twoPartyOutcomeInterpreterParams: undefined,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    ...overrides,
  };
};

export const createStateChannelJSON = (
  overrides: Partial<StateChannelJSON> = {},
): StateChannelJSON => {
  const userIdentifiers = [generateRandomAddress(), generateRandomAddress()];
  const channelData: Omit<StateChannelJSON, "freeBalanceAppInstance"> = {
    addresses: {
      minimumViableMultisig: "",
      proxyFactory: "",
    },
    appInstances: [],
    monotonicNumProposedApps: 0,
    multisigAddress: generateRandomAddress(),
    proposedAppInstances: [],
    schemaVersion: 1,
    userIdentifiers,
    ...overrides,
  };

  return {
    ...channelData,
    freeBalanceAppInstance: createAppInstanceJson({
      multisigAddress: channelData.multisigAddress,
      initiatorIdentifier: channelData.userIdentifiers[0],
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
      participants: [generateRandomAddress(), generateRandomAddress()],
      multisigAddress: generateRandomAddress(),
      appDefinition: AddressZero,
      defaultTimeout: Zero,
    },
    appIdentityHash: generateRandomBytes32(),
    appStateHash: generateRandomBytes32(),
    challengeRegistryAddress: AddressZero,
    signatures: [generateRandomSignature(), generateRandomSignature()],
    stateTimeout: Zero,
    versionNumber: Zero,
    ...overrides,
  });
};

export const createConditionalTransactionCommitmentJSON = (
  overrides: Partial<ConditionalTransactionCommitmentJSON> = {},
): ConditionalTransactionCommitmentJSON => {
  return {
    appIdentityHash: generateRandomBytes32(),
    freeBalanceAppIdentityHash: generateRandomBytes32(),
    interpreterAddr: AddressZero,
    interpreterParams: "",
    multisigAddress: generateRandomAddress(),
    multisigOwners: [generateRandomAddress(), generateRandomAddress()],
    contractAddresses: {} as ContractAddresses,
    signatures: [generateRandomSignature(), generateRandomSignature()],
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
    action:"0x",
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
