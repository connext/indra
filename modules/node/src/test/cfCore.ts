import {
  AppInstanceJson,
  OutcomeType,
  AppInstanceProposal,
  StateChannelJSON,
  SetStateCommitmentJSON,
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
} from "@connext/types";
import { Wallet, BigNumber, utils, constants } from "ethers";

export const generateRandomAddress = () => Wallet.createRandom().address;

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
    initiatorIdentifier: generateRandomAddress(),
    responderIdentifier: generateRandomAddress(),
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
    initiatorIdentifier: generateRandomAddress(),
    responderIdentifier: generateRandomAddress(),
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
  return {
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
    stateTimeout: constants.Zero.toHexString(),
    versionNumber: 0,
    ...overrides,
  };
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
