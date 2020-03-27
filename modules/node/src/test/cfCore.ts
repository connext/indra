import {
  AppInstanceJson,
  OutcomeType,
  AppInstanceProposal,
  StateChannelJSON,
} from "@connext/types";
import { AddressZero, HashZero } from "ethers/constants";
import { mkXpub, mkHash } from "./utils";
import { Wallet } from "ethers";
import { HDNode } from "ethers/utils";
import { xkeyKthAddress } from "@connext/cf-core";

export const generateRandomXpub = () =>
  HDNode.fromMnemonic(Wallet.createRandom().mnemonic).neuter().extendedKey;

export const createAppInstanceJson = (
  identityHash = HashZero,
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
    identityHash,
    latestState: {},
    latestTimeout: 1000,
    latestVersionNumber: 0,
    multisigAddress: AddressZero,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    participants: [],
    multiAssetMultiPartyCoinTransferInterpreterParams: null,
    singleAssetTwoPartyCoinTransferInterpreterParams: null,
    twoPartyOutcomeInterpreterParams: null,
    ...overrides,
  };
};

export const createAppInstanceProposal = (
  identityHash = HashZero,
  overrides: Partial<AppInstanceProposal> = {},
): AppInstanceProposal => {
  return {
    appDefinition: AddressZero,
    appSeqNo: 0,
    identityHash,
    abiEncodings: {
      actionEncoding: "",
      stateEncoding: "",
    },
    initialState: {},
    initiatorDeposit: "0",
    initiatorDepositTokenAddress: AddressZero,
    proposedByIdentifier: mkXpub(),
    proposedToIdentifier: mkXpub(),
    responderDeposit: "0",
    responderDepositTokenAddress: AddressZero,
    timeout: "0",
    multiAssetMultiPartyCoinTransferInterpreterParams: null,
    singleAssetTwoPartyCoinTransferInterpreterParams: null,
    twoPartyOutcomeInterpreterParams: null,
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
    multisigAddress: AddressZero,
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
    freeBalanceAppInstance: createAppInstanceJson(mkHash("0xf"), {
      multisigAddress: channelData.multisigAddress,
      participants: freeBalanceParticipants,
      ...overrides.freeBalanceAppInstance,
    }),
  };
};
