import {
  ConnextStore,
  KeyValueStorage,
  WrappedLocalStorage,
  FileStorage,
  WrappedAsyncStorage,
} from "@connext/store";
import {
  StoreFactoryOptions,
  StorePair,
  StoreType,
  StoreTypes,
  ASYNCSTORAGE,
  WrappedStorage,
  LOCALSTORAGE,
  FILESTORAGE,
  AppInstanceProposal,
  StateChannelJSON,
  AppInstanceJson,
  OutcomeType,
  ProtocolTypes,
  SetStateCommitmentJSON,
  NetworkContext,
  ConditionalTransactionCommitmentJSON,
} from "@connext/types";
import { BigNumber, hexlify, randomBytes } from "ethers/utils";
import MockAsyncStorage from "mock-async-storage";
import uuid from "uuid";

import { expect } from "../";
import { One } from "ethers/constants";

export const TEST_STORE_PAIR: StorePair = { path: "testing", value: "something" };

export const TEST_STORE_ETH_ADDRESS: string = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";

export const TEST_STORE_APP_INSTANCE: AppInstanceJson = {
  identityHash: "identityHashApp",
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  participants: ["sender", "receiver"],
  defaultTimeout: 0,
  appInterface: {
    addr: TEST_STORE_ETH_ADDRESS,
    actionEncoding: `action encoding`,
    stateEncoding: `state encoding`,
  },
  appSeqNo: 1,
  latestVersionNumber: 2,
  latestTimeout: 3,
  latestState: {
    counter: 4,
  },
  outcomeType: 5,
  twoPartyOutcomeInterpreterParams: undefined,
  singleAssetTwoPartyCoinTransferInterpreterParams: undefined,
  multiAssetMultiPartyCoinTransferInterpreterParams: undefined,
};

export const TEST_STORE_PROPOSAL: AppInstanceProposal = {
  abiEncodings: {
    actionEncoding: `action encoding`,
    stateEncoding: `state encoding`,
  },
  appDefinition: TEST_STORE_ETH_ADDRESS,
  appSeqNo: 1,
  identityHash: "identityHashProposal",
  initialState: {
    counter: 4,
  },
  initiatorDeposit: "10",
  initiatorDepositTokenAddress: TEST_STORE_ETH_ADDRESS,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  proposedByIdentifier: "xpub1",
  proposedToIdentifier: "xpub2",
  responderDeposit: "11",
  responderDepositTokenAddress: TEST_STORE_ETH_ADDRESS,
  timeout: "123456",
  twoPartyOutcomeInterpreterParams: undefined,
  singleAssetTwoPartyCoinTransferInterpreterParams: undefined,
  multiAssetMultiPartyCoinTransferInterpreterParams: undefined,
};

export const TEST_STORE_CHANNEL: StateChannelJSON = {
  schemaVersion: 1,
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  addresses: {
    multisigMastercopy: TEST_STORE_ETH_ADDRESS,
    proxyFactory: TEST_STORE_ETH_ADDRESS,
  },
  userNeuteredExtendedKeys: ["xpub1", "xpub2"],
  proposedAppInstances: [[TEST_STORE_PROPOSAL.identityHash, TEST_STORE_PROPOSAL]],
  appInstances: [[TEST_STORE_APP_INSTANCE.identityHash, TEST_STORE_APP_INSTANCE]],
  freeBalanceAppInstance: TEST_STORE_APP_INSTANCE,
  monotonicNumProposedApps: 2,
};

export const TEST_STORE_MINIMAL_TX: ProtocolTypes.MinimalTransaction = {
  to: TEST_STORE_ETH_ADDRESS,
  value: One,
  data: hexlify(randomBytes(64)),
};

export const TEST_STORE_SET_STATE_COMMITMENT: SetStateCommitmentJSON = {
  appIdentity: {
    channelNonce: TEST_STORE_APP_INSTANCE.appSeqNo,
    participants: TEST_STORE_APP_INSTANCE.participants,
    appDefinition: TEST_STORE_APP_INSTANCE.appInterface.addr,
    defaultTimeout: 35,
  },
  appIdentityHash: TEST_STORE_APP_INSTANCE.identityHash,
  appStateHash: "setStateAppStateHash",
  challengeRegistryAddress: TEST_STORE_ETH_ADDRESS,
  timeout: 17,
  versionNumber: 23,
  signatures: ["sig1", "sig2"] as any[], // Signature type, lazy mock
};

export const TEST_STORE_CONDITIONAL_COMMITMENT: ConditionalTransactionCommitmentJSON = {
  appIdentityHash: TEST_STORE_APP_INSTANCE.identityHash,
  freeBalanceAppIdentityHash: "conditionalFreeBalance",
  interpreterAddr: TEST_STORE_ETH_ADDRESS,
  interpreterParams: "conditionalInterpreter",
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  multisigOwners: TEST_STORE_CHANNEL.userNeuteredExtendedKeys,
  networkContext: {} as NetworkContext,
  signatures: ["sig1", "sig2"] as any[], // Signature type, lazy mock
};

export function createKeyValueStore(type: StoreType, opts: StoreFactoryOptions = {}) {
  switch (type) {
    case ASYNCSTORAGE:
      return new KeyValueStorage(
        new WrappedAsyncStorage(
          new MockAsyncStorage(),
          opts.prefix,
          opts.separator,
          opts.asyncStorageKey,
        ),
      );
    case LOCALSTORAGE:
      return new KeyValueStorage(new WrappedLocalStorage(opts.prefix, opts.separator));
    case FILESTORAGE:
      return new KeyValueStorage(
        new FileStorage(opts.prefix, opts.separator, opts.fileExt, opts.fileDir),
      );
    default:
      throw new Error(`Unable to create KeyValueStore from type: ${type}`);
  }
}

export function createConnextStore(type: StoreType, opts: StoreFactoryOptions = {}): ConnextStore {
  if (!Object.values(StoreTypes).includes(type)) {
    throw new Error(`Unrecognized type: ${type}`);
  }

  if (type === ASYNCSTORAGE) {
    opts.storage = new MockAsyncStorage();
  }

  const store = new ConnextStore(type, opts);
  expect(store).to.be.instanceOf(ConnextStore);

  return store;
}

export function createArray(length: number = 10): string[] {
  return Array(length).fill("");
}

export function generateStorePairs(length: number = 10): StorePair[] {
  return createArray(length).map(() => {
    const id = uuid.v1();
    return { path: `path-${id}`, value: `value-${id}` };
  });
}

export async function setAndGet(
  store: KeyValueStorage,
  pair: StorePair = TEST_STORE_PAIR,
): Promise<void> {
  await store.setItem(pair.path, pair.value);
  const value = await store.getItem(pair.path);
  if (typeof pair.value === "object" && !BigNumber.isBigNumber(pair.value)) {
    expect(value).to.be.deep.equal(pair.value);
    return;
  }
  expect(value).to.be.equal(pair.value);
}

export async function setAndGetMultiple(
  store: KeyValueStorage,
  length: number = 10,
): Promise<void> {
  const pairs = generateStorePairs(length);
  expect(pairs.length).to.equal(length);
  for (const pair of pairs) {
    await setAndGet(store, pair);
  }
}

export async function testAsyncStorageKey(
  storage: WrappedStorage,
  asyncStorageKey: string,
): Promise<void> {
  const keys = await storage.getKeys();
  expect(keys.length).to.equal(1);
  expect(keys[0]).to.equal(asyncStorageKey);
}
