import {
  AppInstanceJson,
  OutcomeType,
  AppInstanceProposal,
  StateChannelJSON,
  SetStateCommitmentJSON,
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
} from "@connext/types";
import { AddressZero, HashZero, Zero } from "ethers/constants";
import { mkHash } from "./utils";
import { Wallet } from "ethers";
import { HDNode, hexlify } from "ethers/utils";
import { xkeyKthAddress } from "@connext/cf-core";
import { randomBytes } from "crypto";

export const generateRandomXpub = () =>
  HDNode.fromMnemonic(Wallet.createRandom().mnemonic).neuter().extendedKey;

export const generateRandomAddress = () => Wallet.createRandom().address;

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
    defaultTimeout: 0,
    identityHash: generateRandomBytes32(),
    latestState: {},
    latestTimeout: 1000,
    latestVersionNumber: 0,
    multisigAddress: generateRandomAddress(),
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    participants: [generateRandomAddress(), generateRandomAddress()],
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
    initiatorDepositTokenAddress: AddressZero,
    proposedByIdentifier: generateRandomXpub(),
    proposedToIdentifier: generateRandomXpub(),
    responderDeposit: "0x00",
    responderDepositTokenAddress: AddressZero,
    timeout: "0x00",
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
  const userNeuteredExtendedKeys = [generateRandomXpub(), generateRandomXpub()];
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
    userNeuteredExtendedKeys,
    ...overrides,
  };

  const freeBalanceParticipants = channelData.userNeuteredExtendedKeys.map(xpub =>
    xkeyKthAddress(xpub),
  );
  return {
    ...channelData,
    freeBalanceAppInstance: createAppInstanceJson({
      multisigAddress: channelData.multisigAddress,
      participants: freeBalanceParticipants,
      ...overrides.freeBalanceAppInstance,
    }),
  };
};

export const createSetStateCommitmentJSON = (
  overrides: Partial<SetStateCommitmentJSON> = {},
): SetStateCommitmentJSON => {
  return {
    appIdentity: {
      channelNonce: 0,
      participants: [generateRandomAddress(), generateRandomAddress()],
      appDefinition: AddressZero,
      defaultTimeout: 0,
    },
    appIdentityHash: generateRandomBytes32(),
    appStateHash: generateRandomBytes32(),
    challengeRegistryAddress: AddressZero,
    signatures: [generateRandomSignature(), generateRandomSignature()],
    timeout: 0,
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
    interpreterAddr: AddressZero,
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
    data: HashZero,
    to: AddressZero,
    value: Zero,
    ...overrides,
  };
};
