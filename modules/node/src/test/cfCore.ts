import {
  AppInstanceJson,
  OutcomeType,
  AppInstanceProposal,
  StateChannelJSON,
  SetStateCommitmentJSON,
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  StoredAppChallenge,
  ChallengeStatus,
  StateProgressedEventPayload,
  ChallengeUpdatedEventPayload,
} from "@connext/types";
import {
  deBigNumberifyJson,
  getRandomBytes32,
  getRandomAddress,
  getRandomChannelSigner,
} from "@connext/utils";
import { Wallet, BigNumber, utils, constants } from "ethers";

export const generateRandomAddress = () => Wallet.createRandom().address;

export const generateRandomIdentifier = () => getRandomChannelSigner().publicIdentifier;

export const generateRandomBytes32 = () => utils.hexlify(utils.randomBytes(32));

export const generateRandomSignature = () => utils.hexlify(utils.randomBytes(65));

export const createAppInstanceJson = (
  overrides: Partial<AppInstanceJson> = {},
): AppInstanceJson => {
  return {
    appInterface: {
      actionEncoding: null,
      addr: constants.AddressZero,
      stateEncoding: "",
    },
    appSeqNo: 0,
    defaultTimeout: constants.Zero.toHexString(),
    identityHash: generateRandomBytes32(),
    latestState: {},
    stateTimeout: BigNumber.from(1000).toHexString(),
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
    appDefinition: constants.AddressZero,
    appSeqNo: 0,
    identityHash: generateRandomBytes32(),
    abiEncodings: {
      actionEncoding: "",
      stateEncoding: "",
    },
    initialState: {},
    initiatorDeposit: "0x00",
    initiatorDepositAssetId: constants.AddressZero,
    initiatorIdentifier: generateRandomIdentifier(),
    responderIdentifier: generateRandomIdentifier(),
    responderDeposit: "0x00",
    responderDepositAssetId: constants.AddressZero,
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
      multisigMastercopy: "",
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
      channelNonce: constants.Zero,
      participants: [generateRandomAddress(), generateRandomAddress()],
      multisigAddress: generateRandomAddress(),
      appDefinition: constants.AddressZero,
      defaultTimeout: constants.Zero,
    },
    appIdentityHash: generateRandomBytes32(),
    appStateHash: generateRandomBytes32(),
    challengeRegistryAddress: constants.AddressZero,
    signatures: [generateRandomSignature(), generateRandomSignature()],
    stateTimeout: constants.Zero,
    versionNumber: constants.Zero,
    ...overrides,
  });
};

export const createConditionalTransactionCommitmentJSON = (
  overrides: Partial<ConditionalTransactionCommitmentJSON> = {},
): ConditionalTransactionCommitmentJSON => {
  return {
    appIdentityHash: generateRandomBytes32(),
    freeBalanceAppIdentityHash: generateRandomBytes32(),
    interpreterAddr: constants.AddressZero,
    interpreterParams: "",
    multisigAddress: generateRandomAddress(),
    multisigOwners: [generateRandomAddress(), generateRandomAddress()],
    networkContext: {} as any,
    signatures: [generateRandomSignature(), generateRandomSignature()],
    ...overrides,
  };
};

export const createMinimalTransaction = (
  overrides: Partial<MinimalTransaction> = {},
): MinimalTransaction => {
  return {
    data: constants.HashZero,
    to: constants.AddressZero,
    value: constants.Zero,
    ...overrides,
  };
};

export const createStoredAppChallenge = (
  overrides: Partial<StoredAppChallenge> = {},
): StoredAppChallenge => {
  return {
    identityHash: getRandomBytes32(),
    appStateHash: getRandomBytes32(),
    versionNumber: constants.One,
    finalizesAt: constants.Zero,
    status: ChallengeStatus.IN_DISPUTE,
    ...overrides,
  };
};

export const createStateProgressedEventPayload = (
  overrides: Partial<StateProgressedEventPayload> = {},
): StateProgressedEventPayload => {
  return {
    identityHash: getRandomBytes32(),
    action: "0x",
    versionNumber: constants.One,
    timeout: constants.Zero,
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
    versionNumber: constants.One,
    finalizesAt: constants.Zero,
    status: ChallengeStatus.IN_DISPUTE,
    ...overrides,
  };
};
