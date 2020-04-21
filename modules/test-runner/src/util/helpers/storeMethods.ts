import {
  ConnextStore,
  KeyValueStorage,
  WrappedLocalStorage,
  FileStorage,
  WrappedAsyncStorage,
  WrappedPostgresStorage,
} from "@connext/store";
import {
  StoreFactoryOptions,
  StorePair,
  StoreTypes,
  WrappedStorage,
  AppInstanceProposal,
  StateChannelJSON,
  AppInstanceJson,
  OutcomeType,
  MinimalTransaction,
  SetStateCommitmentJSON,
  NetworkContext,
  ConditionalTransactionCommitmentJSON,
} from "@connext/types";
import { toBN, toBNJson } from "@connext/utils";
import { BigNumber, hexlify, randomBytes } from "ethers/utils";
import MockAsyncStorage from "mock-async-storage";
import { v4 as uuid } from "uuid";

import { expect, env } from "../";
import { One, AddressZero } from "ethers/constants";

export const TEST_STORE_PAIR: StorePair = { path: "testing", value: "something" };

export const TEST_STORE_ETH_ADDRESS: string = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";

export const TEST_STORE_APP_INSTANCE: AppInstanceJson = {
  identityHash: "identityHashApp",
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  initiatorIdentifier: "sender",
  responderIdentifier: "receiver",
  defaultTimeout: "0x00",
  appInterface: {
    addr: TEST_STORE_ETH_ADDRESS,
    actionEncoding: `action encoding`,
    stateEncoding: `state encoding`,
  },
  appSeqNo: 1,
  latestVersionNumber: 2,
  stateTimeout: "0x01",
  latestState: {
    counter: 4,
  },
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  twoPartyOutcomeInterpreterParams: {
    amount: { _hex: "0x42" } as any,
    playerAddrs: [AddressZero, AddressZero],
    tokenAddress: AddressZero,
  },
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
  initiatorDepositAssetId: TEST_STORE_ETH_ADDRESS,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  initiatorIdentifier: "address1",
  responderIdentifier: "address2",
  responderDeposit: "11",
  responderDepositAssetId: TEST_STORE_ETH_ADDRESS,
  defaultTimeout: "0x01",
  stateTimeout: "0x00",
  singleAssetTwoPartyCoinTransferInterpreterParams: {
    limit: { _hex: "0x1" } as any,
    tokenAddress: AddressZero,
  },
};

export const TEST_STORE_CHANNEL: StateChannelJSON = {
  schemaVersion: 1,
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  addresses: {
    multisigMastercopy: TEST_STORE_ETH_ADDRESS,
    proxyFactory: TEST_STORE_ETH_ADDRESS,
  },
  userIdentifiers: ["address1", "address2"],
  proposedAppInstances: [[TEST_STORE_PROPOSAL.identityHash, TEST_STORE_PROPOSAL]],
  appInstances: [[TEST_STORE_APP_INSTANCE.identityHash, TEST_STORE_APP_INSTANCE]],
  freeBalanceAppInstance: TEST_STORE_APP_INSTANCE,
  monotonicNumProposedApps: 2,
};

export const TEST_STORE_MINIMAL_TX: MinimalTransaction = {
  to: TEST_STORE_ETH_ADDRESS,
  value: One,
  data: hexlify(randomBytes(64)),
};

export const TEST_STORE_SET_STATE_COMMITMENT: SetStateCommitmentJSON = {
  appIdentity: {
    channelNonce: toBN(TEST_STORE_APP_INSTANCE.appSeqNo),
    participants: [
      TEST_STORE_APP_INSTANCE.initiatorIdentifier,
      TEST_STORE_APP_INSTANCE.responderIdentifier,
    ],
    multisigAddress: TEST_STORE_APP_INSTANCE.multisigAddress,
    appDefinition: TEST_STORE_APP_INSTANCE.appInterface.addr,
    defaultTimeout: toBN(35),
  },
  appIdentityHash: TEST_STORE_APP_INSTANCE.identityHash,
  appStateHash: "setStateAppStateHash",
  challengeRegistryAddress: TEST_STORE_ETH_ADDRESS,
  stateTimeout: toBNJson(17),
  versionNumber: toBNJson(23),
  signatures: ["sig1", "sig2"] as any[], // Signature type, lazy mock
};

export const TEST_STORE_CONDITIONAL_COMMITMENT: ConditionalTransactionCommitmentJSON = {
  appIdentityHash: TEST_STORE_APP_INSTANCE.identityHash,
  freeBalanceAppIdentityHash: "conditionalFreeBalance",
  interpreterAddr: TEST_STORE_ETH_ADDRESS,
  interpreterParams: "conditionalInterpreter",
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  multisigOwners: TEST_STORE_CHANNEL.userIdentifiers,
  networkContext: {} as NetworkContext,
  signatures: ["sig1", "sig2"] as any[], // Signature type, lazy mock
};

export function createKeyValueStore(type: StoreTypes, opts: StoreFactoryOptions = {}) {
  switch (type) {
    case StoreTypes.AsyncStorage:
      return new KeyValueStorage(
        new WrappedAsyncStorage(
          new MockAsyncStorage(),
          opts.prefix,
          opts.separator,
          opts.asyncStorageKey,
        ),
      );
    case StoreTypes.LocalStorage:
      return new KeyValueStorage(new WrappedLocalStorage(opts.prefix, opts.separator));
    case StoreTypes.File:
      return new KeyValueStorage(
        new FileStorage(opts.prefix, opts.separator, opts.fileExt, opts.fileDir),
      );
    default:
      throw new Error(`Unable to create KeyValueStore from type: ${type}`);
  }
}

export async function createConnextStore(
  type: StoreTypes,
  opts: StoreFactoryOptions = {},
): Promise<ConnextStore> {
  if (!Object.values(StoreTypes).includes(type)) {
    throw new Error(`Unrecognized type: ${type}`);
  }

  if (type === StoreTypes.Postgres) {
    const wrappedStore = new WrappedPostgresStorage(
      "test",
      "/",
      undefined,
      undefined,
      `postgres://${env.dbConfig.user}:${env.dbConfig.password}@${env.dbConfig.host}:${env.dbConfig.port}/${env.dbConfig.database}`,
      opts.backupService,
    );
    opts.storage = wrappedStore;
    await wrappedStore.sequelize.authenticate();
    await wrappedStore.syncModels(true);
  }

  if (type === StoreTypes.AsyncStorage) {
    opts.storage = new MockAsyncStorage();
  }

  const store = new ConnextStore(type, opts);
  expect(store).to.be.instanceOf(ConnextStore);

  await store.clear();

  return store;
}

export function createArray(length: number = 10): string[] {
  return Array(length).fill("");
}

export function generateStorePairs(length: number = 10): StorePair[] {
  return createArray(length).map(() => {
    const id = uuid();
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
