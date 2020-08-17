import {
  AppInstanceJson,
  ChallengeStatus,
  ChallengeUpdatedEventPayload,
  ConditionalTransactionCommitmentJSON,
  ContractAddresses,
  IBackupService,
  IStoreService,
  MinimalTransaction,
  OutcomeType,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StateProgressedEventPayload,
  StoredAppChallenge,
  StoredAppChallengeStatus,
  StorePair,
} from "@connext/types";
import { ColorfulLogger, toBN, toBNJson, getRandomBytes32 } from "@connext/utils";
import { expect, use } from "chai";
import MockAsyncStorage from "mock-async-storage";
import { v4 as uuid } from "uuid";
import { BigNumber, constants, utils } from "ethers";

import {
  getAsyncStore,
  getFileStore,
  getLocalStore,
  getMemoryStore,
  getPostgresStore,
} from "../index";
import { StoreService } from "../store";
import { StoreOptions, StoreTypes } from "../types";

const { One, AddressZero } = constants;
const { hexlify, randomBytes } = utils;

use(require("chai-as-promised"));
use(require("chai-subset"));

export { expect } from "chai";

const env = {
  defaultChain: parseInt(process.env.INDRA_DEFAULT_CHAIN || "1337", 10),
  database: process.env.INDRA_PG_DATABASE || "",
  host: process.env.INDRA_PG_HOST || "",
  password: process.env.INDRA_PG_PASSWORD || "",
  port: parseInt(process.env.INDRA_PG_PORT || "", 10),
  user: process.env.INDRA_PG_USERNAME || "",
  logLevel: parseInt(process.env.LOG_LEVEL || "0", 10),
};

type TestStoreOptions = StoreOptions & {
  fileDir?: string;
};

////////////////////////////////////////
// Helper Methods

export const postgresConnectionUri = `postgres://${env.user}:${env.password}@${env.host}:${env.port}/${env.database}`;

export const createStore = async (
  type: StoreTypes,
  opts: TestStoreOptions = {},
): Promise<IStoreService> => {
  opts.logger = new ColorfulLogger(`ConnextStore_${type}`, env.logLevel, true);
  let store: IStoreService;
  if (type === StoreTypes.AsyncStorage) {
    store = getAsyncStore(new MockAsyncStorage(), opts);
  } else if (type === StoreTypes.File) {
    store = getFileStore(opts.fileDir || "./.test-store", opts);
  } else if (type === StoreTypes.LocalStorage) {
    store = getLocalStore(opts);
  } else if (type === StoreTypes.Memory) {
    store = getMemoryStore(opts);
  } else if (type === StoreTypes.Postgres) {
    store = getPostgresStore(opts.sequelize || postgresConnectionUri, opts);
  } else {
    throw new Error(`${type} should be one of ${Object.keys(StoreTypes)}`);
  }
  await store.init();
  await store.clear();
  return store;
};

export const setAndGet = async (
  store: StoreService,
  pair: StorePair = TEST_STORE_PAIR,
): Promise<void> => {
  await store.setItem(pair.path, pair.value);
  const value = await store.getItem(pair.path);
  if (typeof pair.value === "object" && !BigNumber.isBigNumber(pair.value)) {
    expect(value).to.be.deep.equal(pair.value);
    return;
  }
  expect(value).to.be.equal(pair.value);
};

export const setAndGetMultiple = async (
  store: StoreService,
  length: number = 10,
): Promise<void> => {
  const pairs = Array(length)
    .fill(0)
    .map(() => {
      const id = uuid();
      return { path: `path-${id}`, value: `value-${id}` };
    });

  expect(pairs.length).to.equal(length);
  for (const pair of pairs) {
    await setAndGet(store, pair);
  }
};

export const testAsyncStorageKey = async (
  storage: StoreService,
  asyncStorageKey: string,
): Promise<void> => {
  const keys = await storage.getKeys();
  expect(keys.length).to.equal(1);
  expect(keys[0]).to.equal(asyncStorageKey);
};

/**
 * Class simply holds all the states in memory that would otherwise get
 * backed up by the service.
 *
 * TODO: Currently the implementation implies that the backup service
 * will have write access to the store (or at least there is no specific
 * call to `.set` when calling `restoreState` in
 * `client/src/channelProvider.ts`). This should be addressed in a larger
 * store refactor, and it is not clear how this would impact backwards
 * compatability of custom stores.
 */
export class MockBackupService implements IBackupService {
  private prefix: string;
  private storage = new Map<string, any>();

  constructor(prefix: string = "backup/") {
    this.prefix = prefix;
  }

  public async restore(): Promise<StorePair[]> {
    this.storage.keys();
    const keys: string[] = [];
    for (const key of this.storage.keys()) {
      if (key.includes(this.prefix)) {
        keys.push(key);
      }
    }
    const statesToRestore: StorePair[] = [];
    for (const key of keys) {
      const value = this.storage.get(key);
      const path = key.split(this.prefix)[1];
      statesToRestore.push({ path, value });
      this.storage.set(path, value);
    }
    return statesToRestore;
  }

  public async backup(pair: StorePair): Promise<any> {
    return this.storage.set(`${this.prefix}${pair.path}`, pair.value);
  }
}

////////////////////////////////////////
// Example Data

export const TEST_STORE_PAIR: StorePair = { path: "testing", value: "something" };

export const TEST_STORE_ETH_ADDRESS: string = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";

export const TEST_STORE_APP_INSTANCE: AppInstanceJson = {
  identityHash: getRandomBytes32(),
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  initiatorIdentifier: "sender",
  initiatorDeposit: "10",
  initiatorDepositAssetId: TEST_STORE_ETH_ADDRESS,
  responderIdentifier: "receiver",
  responderDeposit: "11",
  responderDepositAssetId: TEST_STORE_ETH_ADDRESS,
  defaultTimeout: "0x00",
  appDefinition: TEST_STORE_ETH_ADDRESS,
  abiEncodings: {
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
  outcomeInterpreterParameters: {
    amount: { _hex: "0x42", _isBigNumber: true } as any,
    playerAddrs: [AddressZero, AddressZero],
    tokenAddress: AddressZero,
  },
};

export const TEST_STORE_PROPOSAL: AppInstanceJson = {
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  abiEncodings: {
    actionEncoding: `action encoding`,
    stateEncoding: `state encoding`,
  },
  appDefinition: TEST_STORE_ETH_ADDRESS,
  appSeqNo: 1,
  identityHash: getRandomBytes32(),
  latestState: {
    counter: 4,
  },
  latestVersionNumber: 1,
  initiatorDeposit: "10",
  initiatorDepositAssetId: TEST_STORE_ETH_ADDRESS,
  outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
  initiatorIdentifier: "address1",
  responderIdentifier: "address2",
  responderDeposit: "11",
  responderDepositAssetId: TEST_STORE_ETH_ADDRESS,
  defaultTimeout: "0x01",
  stateTimeout: "0x00",
  outcomeInterpreterParameters: {
    limit: { _hex: "0x1", _isBigNumber: true } as any,
    tokenAddress: AddressZero,
  },
};

export const TEST_STORE_CHANNEL: StateChannelJSON = {
  schemaVersion: 1,
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  chainId: env.defaultChain,
  addresses: {
    MinimumViableMultisig: TEST_STORE_ETH_ADDRESS,
    ProxyFactory: TEST_STORE_ETH_ADDRESS,
  },
  userIdentifiers: ["address1", "address2"],
  proposedAppInstances: [[TEST_STORE_PROPOSAL.identityHash, TEST_STORE_PROPOSAL]],
  appInstances: [[TEST_STORE_APP_INSTANCE.identityHash, TEST_STORE_APP_INSTANCE]],
  freeBalanceAppInstance: { ...TEST_STORE_APP_INSTANCE, identityHash: getRandomBytes32() },
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
    appDefinition: TEST_STORE_APP_INSTANCE.appDefinition,
    defaultTimeout: toBN(35),
  },
  appIdentityHash: TEST_STORE_APP_INSTANCE.identityHash,
  appStateHash: "setStateAppStateHash",
  challengeRegistryAddress: TEST_STORE_ETH_ADDRESS,
  stateTimeout: toBNJson(17),
  versionNumber: toBNJson(23),
  transactionData: "0xdeadbeef",
  signatures: ["sig1", "sig2"] as any[], // Signature type, lazy mock
};

export const TEST_STORE_CONDITIONAL_COMMITMENT: ConditionalTransactionCommitmentJSON = {
  appIdentityHash: TEST_STORE_APP_INSTANCE.identityHash,
  contractAddresses: {} as ContractAddresses,
  freeBalanceAppIdentityHash: "conditionalFreeBalance",
  interpreterAddr: TEST_STORE_ETH_ADDRESS,
  interpreterParams: "conditionalInterpreter",
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  multisigOwners: TEST_STORE_CHANNEL.userIdentifiers,
  transactionData: "0xdeadbeef",
  signatures: ["sig1", "sig2"] as any[], // Signature type, lazy mock
};

export const TEST_STORE_APP_CHALLENGE: StoredAppChallenge = {
  identityHash: TEST_STORE_APP_INSTANCE.identityHash,
  appStateHash: getRandomBytes32(),
  versionNumber: toBN(1),
  finalizesAt: toBN(3),
  status: StoredAppChallengeStatus.IN_DISPUTE,
  chainId: env.defaultChain,
};

export const TEST_STORE_STATE_PROGRESSED_EVENT: StateProgressedEventPayload = {
  identityHash: TEST_STORE_APP_INSTANCE.identityHash,
  action: getRandomBytes32(),
  versionNumber: toBN(1),
  timeout: toBN(3),
  turnTaker: TEST_STORE_CHANNEL.userIdentifiers[0],
  signature: getRandomBytes32(),
  chainId: env.defaultChain,
};

export const TEST_STORE_CHALLENGE_UPDATED_EVENT: ChallengeUpdatedEventPayload = {
  identityHash: TEST_STORE_APP_INSTANCE.identityHash,
  appStateHash: getRandomBytes32(),
  versionNumber: toBN(1),
  finalizesAt: toBN(3),
  status: ChallengeStatus.IN_DISPUTE,
  chainId: env.defaultChain,
};
