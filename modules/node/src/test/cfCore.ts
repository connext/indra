import {
  AppInstanceJson,
  OutcomeType,
  AppInstanceProposal,
  StateChannelJSON,
} from "@connext/types";
import { AddressZero, HashZero, Zero } from "ethers/constants";
import { mkXpub, mkHash } from "./utils";

export const createAppInstanceJson = (
  identityHash = HashZero,
  overrides: Partial<AppInstanceJson> = {},
): AppInstanceJson => {
  return {
    appInterface: {
      actionEncoding: "",
      addr: AddressZero,
      stateEncoding: "",
    },
    appSeqNo: 0,
    defaultTimeout: 0,
    identityHash: HashZero,
    latestState: {},
    latestTimeout: 1000,
    latestVersionNumber: 0,
    multisigAddress: AddressZero,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    participants: [],
    multiAssetMultiPartyCoinTransferInterpreterParams: undefined,
    singleAssetTwoPartyCoinTransferInterpreterParams: undefined,
    twoPartyOutcomeInterpreterParams: undefined,
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
    multiAssetMultiPartyCoinTransferInterpreterParams: undefined,
    singleAssetTwoPartyCoinTransferInterpreterParams: undefined,
    twoPartyOutcomeInterpreterParams: undefined,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    ...overrides,
  };
};

export const createStateChannelJSON = (
  overrides: Partial<StateChannelJSON> = {},
): StateChannelJSON => {
  const defaultChannelData: Omit<StateChannelJSON, "freeBalanceAppInstance"> = {
    addresses: {
      multisigMastercopy: "",
      proxyFactory: "",
    },
    appInstances: [],
    monotonicNumProposedApps: 0,
    multisigAddress: AddressZero,
    proposedAppInstances: [],
    schemaVersion: 1,
    userNeuteredExtendedKeys: [mkXpub(), mkXpub()],
  };
  return {
    ...defaultChannelData,
    freeBalanceAppInstance: createAppInstanceJson(mkHash("0xf"), {
      multisigAddress: defaultChannelData.multisigAddress,
    }),
    ...overrides,
  };
};
