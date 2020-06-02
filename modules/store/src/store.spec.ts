import {
  STORE_SCHEMA_VERSION,
  StoredAppChallengeStatus,
  StateChannelJSON,
  SetStateCommitmentJSON,
} from "@connext/types";
import { isDirectory, toBNJson, toBN, getRandomBytes32 } from "@connext/utils";
import { expect } from "chai";
import fs from "fs";
import { Sequelize } from "sequelize";
import { v4 as uuid } from "uuid";

import { storeDefaults } from "./constants";
import {
  createStore,
  expect,
  MockBackupService,
  postgresConnectionUri,
  setAndGet,
  setAndGetMultiple,
  TEST_STORE_APP_CHALLENGE,
  TEST_STORE_CHALLENGE_UPDATED_EVENT,
  TEST_STORE_CHANNEL,
  TEST_STORE_CONDITIONAL_COMMITMENT,
  TEST_STORE_ETH_ADDRESS,
  TEST_STORE_MINIMAL_TX,
  TEST_STORE_PAIR,
  TEST_STORE_SET_STATE_COMMITMENT,
  TEST_STORE_STATE_PROGRESSED_EVENT,
  testAsyncStorageKey,
} from "./test-utils";
import { StoreTypes } from "./types";

const storeTypes = Object.keys(StoreTypes);

const clearAndClose = async (store) => {
  await store.clear();
  await store.close();
};

const length = 10;
const asyncStorageKey = "TEST_CONNEXT_STORE";
const fileDir = "./.test-store";
const testValue = "something";

describe("Store", () => {

  describe("Instantiation", () => {
    describe("happy case: instantiate", () => {
      for (const type of storeTypes) {
        it(`should work for ${type}`, async () => {
          const store = await createStore(type as StoreTypes);
          await setAndGet(store);

          // test + validate entries
          const entries = await store.getEntries();
          expect(entries.length).to.eq(1);
          expect(entries[0]).to.deep.equal([TEST_STORE_PAIR.path, TEST_STORE_PAIR.value]);

          // test clearing
          await store.clear();
          const keys = await store.getKeys();
          expect(keys.length).to.be.eq(0);
        });
      }
    });

    describe("happy case: should be able to remove an item", async () => {
      for (const type of storeTypes) {
        it(`should work for ${type}`, async () => {
          const store = await createStore(type as StoreTypes);
          await setAndGet(store, TEST_STORE_PAIR);
          await store.removeItem(TEST_STORE_PAIR.path);
          const val = await store.getItem(TEST_STORE_PAIR.path);
          expect(val).to.be.undefined;
        });
      }
    });

    it("happy case: memory storage should be able to support multiple stores", async () => {
      const store1 = await createStore(StoreTypes.Memory);
      await store1.setItem("test", "store1");
      const store2 = await createStore(StoreTypes.Memory);
      await store2.setItem("test", "store2");
      const item1 = await store1.getItem("test");
      const item2 = await store2.getItem("test");
      expect(item1).to.eq("store1");
      expect(item2).to.eq("store2");
      await store1.clear();
    });

    it("happy case: postgres storage should be able to create multiple stores with different prefixes", async () => {
      const sharedSequelize = new Sequelize(postgresConnectionUri, { logging: false });
      const store1 = await createStore(StoreTypes.Postgres, { sequelize: sharedSequelize, prefix: "store1" });
      await store1.setItem("test", "store1");
      const store2 = await createStore(StoreTypes.Postgres, { sequelize: sharedSequelize, prefix: "store2" });
      await store2.setItem("test", "store2");
      const item1 = await store1.getItem("test");
      const item2 = await store2.getItem("test");
      expect(item1).to.eq("store1");
      expect(item2).to.eq("store2");
      await store1.clear();
    });

    it("happy case: localStorage should include multiple keys", async () => {
      const store = await createStore(StoreTypes.LocalStorage);
      const preInsert = await store.getEntries();
      await setAndGetMultiple(store, length);
      expect((await store.getEntries()).length).to.equal(preInsert.length + length);
      await store.clear();
    });

    // TODO: fix test
    it.skip("happy case: AsyncStorage should include a single key matching asyncStorageKey", async () => {
      const store = await createStore(StoreTypes.AsyncStorage, { asyncStorageKey });

      await setAndGetMultiple(store, length);

      await testAsyncStorageKey(store, asyncStorageKey);
      await store.clear();
    });

    // TODO: ask pedro about the spirit of this test, and if it still needs to
    // be included/if its still relevant
    it.skip("happy case: FileStorage should include a single key matching asyncStorageKey", async () => {
      const store = await createStore(StoreTypes.File, { asyncStorageKey });
      await setAndGetMultiple(store, length);
      await testAsyncStorageKey(store, asyncStorageKey);
      await store.clear();
    });

    it("happy case: FileStorage should create a store directory after first request", async () => {
      const id = uuid();
      const isDirectoryBefore = await isDirectory(`${fileDir}/${id}`);
      expect(isDirectoryBefore).to.be.false;
      const store = await createStore(StoreTypes.File, {
        asyncStorageKey,
        fileDir: `${fileDir}/${id}`,
      });
      await store.getSchemaVersion();
      const isDirectoryAfter = await isDirectory(`${fileDir}/${id}`);
      expect(isDirectoryAfter).to.be.true;
      await store.clear();
    });

    it("happy case: FileStorage should create a single file for all keys inside directory", async () => {
      const store = await createStore(StoreTypes.File, { asyncStorageKey, fileDir });
      const key1 = uuid();
      const key2 = uuid();
      expect(key1).to.not.equal(key2);
      await Promise.all([store.setItem(key2, testValue), store.setItem(key1, testValue)]);
      const files = fs.readdirSync(fileDir);
      const verifyFile = (fileName: string): void => {
        const fileArr = files.filter((file: string) => file.includes(fileName));
        expect(fileArr.length).to.equal(1);
      };
      verifyFile(storeDefaults.SQLITE_STORE_NAME);
      await store.clear();
    });

    it("happy case: FileStorage should create dirs with unique name", async () => {
      const fileDirA = `${fileDir}/somethingdifferent1`;
      const fileDirB = `${fileDir}/somethingdifferent2`;
      const storeA = await createStore(StoreTypes.File, {
        asyncStorageKey,
        fileDir: fileDirA,
      });
      const storeB = await createStore(StoreTypes.File, {
        asyncStorageKey,
        fileDir: fileDirB,
      });
      const key = uuid();
      await Promise.all([storeA.setItem(key, testValue), storeB.setItem(key, testValue)]);
      const filesA = fs.readdirSync(fileDir);
      const filesB = fs.readdirSync(fileDir);
      const verifyFile = (fileDir: string[]): void => {
        const fileArr = fileDir.filter((file: string) =>
          file.includes(storeDefaults.SQLITE_STORE_NAME),
        );
        expect(fileArr.length).to.equal(1);
      };
      verifyFile(filesA);
      verifyFile(filesB);
      await storeA.clear();
      await storeB.clear();
    });

    describe("happy case: set & get the same path consecutively", async () => {
      for (const type of storeTypes) {
        it(`${type} should work`, async () => {
          const store = await createStore(type as StoreTypes, { fileDir });
          await Promise.all(
            Array(5)
              .fill(0)
              .map(() => setAndGet(store)),
          );
        });
      }
    });

    describe("happy case: should join strings correctly", () => {
      for (const type of storeTypes) {
        it(`${type} should work`, async () => {
          const store = await createStore(type as StoreTypes, { fileDir });
          const expected = `expected/string`;
          expect(store.getKey("expected", "string")).to.be.equal(expected);
        });
      }
    });
  });

  ////////////////////////////////////////

  describe("Methods", () => {

    describe("getSchemaVersion", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          const schema = await store.getSchemaVersion();
          expect(schema).to.be.eq(0);
          await store.updateSchemaVersion();
          const updated = await store.getSchemaVersion();
          expect(updated).to.be.eq(STORE_SCHEMA_VERSION);
          await clearAndClose(store);
        });
      });
    });

    describe("createStateChannel + getStateChannel + getSetupCommitment + getSetStateCommitment", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          await store.updateSchemaVersion();
          const channel = TEST_STORE_CHANNEL;
          const nullValue = await store.getStateChannel(channel.multisigAddress);
          expect(nullValue).to.be.undefined;

          // can be called multiple times in a row and preserve the data
          for (let i = 0; i < 3; i++) {
            await store.createStateChannel(
              channel,
              TEST_STORE_MINIMAL_TX,
              TEST_STORE_SET_STATE_COMMITMENT,
            );
            const retrieved = await store.getStateChannel(channel.multisigAddress);
            expect(retrieved).to.deep.eq(channel);

            const setup = await store.getSetupCommitment(channel.multisigAddress);
            expect(setup).to.containSubset(TEST_STORE_MINIMAL_TX);

            const setState = await store.getSetStateCommitments(
              channel.freeBalanceAppInstance!.identityHash,
            );
            expect(setState.length).to.be.eq(1);
            expect(setState[0]).to.containSubset(TEST_STORE_SET_STATE_COMMITMENT);
          }

          await clearAndClose(store);
        });
      });
    });

    describe("getStateChannelByOwners", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          await store.updateSchemaVersion();
          const channel = TEST_STORE_CHANNEL;
          const owners = channel.userIdentifiers;
          const nullValue = await store.getStateChannelByOwners(owners);
          expect(nullValue).to.be.undefined;
          await store.createStateChannel(
            channel,
            TEST_STORE_MINIMAL_TX,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          const retrieved = await store.getStateChannelByOwners(owners);
          expect(retrieved).to.deep.eq(channel);
          await clearAndClose(store);
        });
      });
    });

    describe("getStateChannelByAppIdentityHash", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          await store.updateSchemaVersion();
          const channel = TEST_STORE_CHANNEL;
          const appIdentityHash = channel.appInstances[0][0];
          const nullValue = await store.getStateChannelByAppIdentityHash(appIdentityHash);
          expect(nullValue).to.be.undefined;
          await store.createStateChannel(
            channel,
            TEST_STORE_MINIMAL_TX,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          const retrieved = await store.getStateChannelByAppIdentityHash(appIdentityHash);
          expect(retrieved).to.deep.eq(channel);
          await clearAndClose(store);
        });
      });
    });

    describe("createAppInstance + updateAppInstance + getAppInstance + getConditionalTransactionCommitment", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
          const app = TEST_STORE_CHANNEL.appInstances[0][1];
          const freeBalanceSetState0 = {
            ...TEST_STORE_SET_STATE_COMMITMENT,
            appIdentityHash: channel.freeBalanceAppInstance!.identityHash,
          };
          const freeBalanceSetState1 = {
            ...freeBalanceSetState0,
            versionNumber: toBNJson(3),
          };
          const appSetState: SetStateCommitmentJSON = {
            ...TEST_STORE_SET_STATE_COMMITMENT,
            appIdentityHash: app.identityHash,
            versionNumber: toBNJson(app.latestVersionNumber),
          };

          const multisigAddress = channel.multisigAddress;
          await store.createStateChannel(channel, TEST_STORE_MINIMAL_TX, freeBalanceSetState0);
          const edited = { ...app, latestVersionNumber: 14 };
          const editedSetState = {
            ...appSetState,
            versionNumber: toBNJson(edited.latestVersionNumber),
          };

          // can be called multiple times in a row and preserve the data
          for (let i = 0; i < 3; i++) {
            await store.createAppInstance(
              multisigAddress,
              app,
              channel.freeBalanceAppInstance!,
              freeBalanceSetState1,
              TEST_STORE_CONDITIONAL_COMMITMENT,
            );
            const retrieved = await store.getAppInstance(app.identityHash);
            expect(retrieved).to.deep.eq(app);
            const freeBalance = await store.getSetStateCommitments(
              channel.freeBalanceAppInstance!.identityHash,
            );
            expect(freeBalance.length).to.be.eq(1);
            expect(freeBalance[0]).to.containSubset(freeBalanceSetState1);
            const conditional = await store.getConditionalTransactionCommitment(app.identityHash);
            expect(conditional).to.containSubset({
              ...TEST_STORE_CONDITIONAL_COMMITMENT,
              appIdentityHash: app.identityHash,
            });
          }

          // can be called multiple times in a row and preserve the data
          for (let i = 0; i < 3; i++) {
            await store.updateAppInstance(multisigAddress, edited, editedSetState);
            const editedRetrieved = await store.getAppInstance(app.identityHash);
            expect(editedRetrieved).to.deep.eq(edited);
            const updatedState = await store.getSetStateCommitments(app.identityHash);
            expect(updatedState.length).to.be.eq(1);
            expect(updatedState[0]).to.containSubset(editedSetState);
            const chan = await store.getStateChannel(multisigAddress);
            expect(chan.appInstances).to.deep.eq([[app.identityHash, edited]]);
          }
          await clearAndClose(store);
        });
      });
    });

    describe("removeAppInstance", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          const app = TEST_STORE_CHANNEL.appInstances[0][1];
          const channel = {
            ...TEST_STORE_CHANNEL,
            proposedAppInstances: [[app.identityHash, app]],
            appInstances: [],
          };
          const freeBalanceSetState0 = {
            ...TEST_STORE_SET_STATE_COMMITMENT,
            appIdentityHash: channel.freeBalanceAppInstance!.identityHash,
          };
          const freeBalanceSetState1 = {
            ...freeBalanceSetState0,
            versionNumber: toBNJson(154),
          };
          const freeBalanceSetState2 = {
            ...freeBalanceSetState0,
            versionNumber: toBNJson(1136),
          };
          const multisigAddress = channel.multisigAddress;
          await store.createStateChannel(
            channel as StateChannelJSON,
            TEST_STORE_MINIMAL_TX,
            freeBalanceSetState0,
          );
          await store.createAppInstance(
            multisigAddress,
            app,
            channel.freeBalanceAppInstance!,
            freeBalanceSetState1,
            TEST_STORE_CONDITIONAL_COMMITMENT,
          );

          // can be called multiple times in a row and preserve the data
          for (let i = 0; i < 3; i++) {
            await store.removeAppInstance(
              multisigAddress,
              app.identityHash,
              channel.freeBalanceAppInstance!,
              freeBalanceSetState2,
            );
            const retrieved = await store.getAppInstance(app.identityHash);
            expect(retrieved).to.be.undefined;
            const chan = await store.getStateChannel(multisigAddress);
            expect(chan).to.deep.eq({
              ...channel,
              proposedAppInstances: [],
            });
            const freeBalance = await store.getSetStateCommitments(
              channel.freeBalanceAppInstance!.identityHash,
            );
            expect(freeBalance.length).to.be.eq(1);
            expect(freeBalance[0]).to.containSubset(freeBalanceSetState2);
          }
          await clearAndClose(store);
        });
      });
    });

    describe("createAppProposal + getAppProposal", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
          const proposal = TEST_STORE_CHANNEL.proposedAppInstances[0][1];
          const multisigAddress = channel.multisigAddress;
          await store.createStateChannel(
            channel,
            TEST_STORE_MINIMAL_TX,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          // can be called multiple times in a row and preserve the data
          for (let i = 0; i < 3; i++) {
            await store.createAppProposal(
              multisigAddress,
              proposal,
              channel.monotonicNumProposedApps,
              TEST_STORE_SET_STATE_COMMITMENT,
            );
            const retrieved = await store.getAppProposal(proposal.identityHash);
            expect(retrieved).to.deep.eq(proposal);
            const chan = await store.getStateChannel(multisigAddress);
            expect(chan.monotonicNumProposedApps).to.be.eq(channel.monotonicNumProposedApps);
            expect(chan.proposedAppInstances).to.deep.eq([[proposal.identityHash, proposal]]);
          }
          await clearAndClose(store);
        });
      });
    });

    describe("removeAppProposal", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
          const proposal = TEST_STORE_CHANNEL.proposedAppInstances[0][1];
          const multisigAddress = channel.multisigAddress;
          await store.createStateChannel(
            channel,
            TEST_STORE_MINIMAL_TX,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          await store.createAppProposal(
            multisigAddress,
            proposal,
            channel.monotonicNumProposedApps,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          // can be called multiple times in a row and preserve the data
          for (let i = 0; i < 3; i++) {
            await store.removeAppProposal(multisigAddress, proposal.identityHash);
            const retrieved = await store.getAppProposal(proposal.identityHash);
            expect(retrieved).to.be.undefined;
            const chan = await store.getStateChannel(multisigAddress);
            expect(chan.proposedAppInstances).to.deep.eq([]);
          }
          await clearAndClose(store);
        });
      });
    });

    describe("getFreeBalance", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
          const freeBalance = channel.freeBalanceAppInstance!;
          const multisigAddress = channel.multisigAddress;
          const nullValue = await store.getFreeBalance(multisigAddress);
          expect(nullValue).to.deep.eq(undefined);
          await store.createStateChannel(
            channel,
            TEST_STORE_MINIMAL_TX,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          const retrieved = await store.getFreeBalance(multisigAddress);
          expect(retrieved).to.deep.eq(freeBalance);
          const chan = await store.getStateChannel(multisigAddress);
          expect(chan.freeBalanceAppInstance).to.deep.eq(freeBalance);
          await clearAndClose(store);
        });
      });
    });

    describe("clear", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should work`, async () => {
          const store = await createStore(type as StoreTypes);
          await store.updateSchemaVersion();
          const multisigAddress = TEST_STORE_ETH_ADDRESS;
          await store.createStateChannel(
            TEST_STORE_CHANNEL,
            TEST_STORE_MINIMAL_TX,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          const retrieved = await store.getStateChannel(multisigAddress);
          expect(retrieved).to.containSubset(TEST_STORE_CHANNEL);
          await store.clear();
          expect(await store.getStateChannel(multisigAddress)).to.containSubset(undefined);
          await clearAndClose(store);
        });
      });
    });

    describe("restore", async () => {
      storeTypes.forEach((type) => {
        it(`${type} - should restore empty state when not provided with a backup service`, async () => {
          const store = await createStore(type as StoreTypes);
          await store.updateSchemaVersion();
          const multisigAddress = TEST_STORE_ETH_ADDRESS;
          await store.createStateChannel(
            TEST_STORE_CHANNEL,
            TEST_STORE_MINIMAL_TX,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          const retrieved = await store.getStateChannel(multisigAddress);
          expect(retrieved).to.containSubset(TEST_STORE_CHANNEL);

          await expect(store.restore()).to.be.rejectedWith(`No backup provided, store cleared`);
          expect(await store.getStateChannel(multisigAddress)).to.containSubset(undefined);
          await clearAndClose(store);
        });

        it(`${type} - should backup state when provided with a backup service`, async () => {
          const store = await createStore(type as StoreTypes, {
            backupService: new MockBackupService(),
          });
          await store.updateSchemaVersion();
          const multisigAddress = TEST_STORE_ETH_ADDRESS;
          await store.createStateChannel(
            TEST_STORE_CHANNEL,
            TEST_STORE_MINIMAL_TX,
            TEST_STORE_SET_STATE_COMMITMENT,
          );
          const retrieved = await store.getStateChannel(multisigAddress);
          expect(retrieved).to.containSubset(TEST_STORE_CHANNEL);
          await store.restore();
          expect(await store.getStateChannel(multisigAddress)).to.containSubset(TEST_STORE_CHANNEL);
          await clearAndClose(store);
        });
      });
    });

    describe.only("getAppChallenge / saveAppChallenge", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should be able to create, get, and update app challenges`, async () => {
          const value = { ...TEST_STORE_APP_CHALLENGE };
          const store = await createStore(type as StoreTypes);
          await store.clear();

          const empty = await store.getAppChallenge(value.identityHash);
          expect(empty).to.be.undefined;

          // can be called multiple times in a row and preserve the data
          for (let i = 0; i < 3; i++) {
            await store.saveAppChallenge(value);
            expect(await store.getAppChallenge(value.identityHash)).to.containSubset(value);
          }
          await clearAndClose(store);
        });
      });

      storeTypes.forEach((type) => {
        it(`${type} -- should be able to handle concurrent writes properly`, async () => {
          const value0 = { ...TEST_STORE_APP_CHALLENGE };
          const value1 = { ...value0, versionNumber: toBN(value0.versionNumber).add(1) };
          const value2 = { ...value0, status: StoredAppChallengeStatus.IN_ONCHAIN_PROGRESSION };
          const value3 = { ...value0, identityHash: getRandomBytes32() };
          const store = await createStore(type as StoreTypes);
          // write all values concurrently
          await Promise.all([
            store.createChallengeUpdatedEvent(value0 as any),
            store.saveAppChallenge(value0),
            store.createChallengeUpdatedEvent(value1 as any),
            store.saveAppChallenge(value1),
            store.saveAppChallenge(value2),
            store.createChallengeUpdatedEvent(value3 as any),
            store.saveAppChallenge(value3),
          ]);
          const [retrieved0, retrieved3, events0, events3] = await Promise.all([
            store.getAppChallenge(value0.identityHash),
            store.getAppChallenge(value3.identityHash),
            store.getChallengeUpdatedEvents(value0.identityHash),
            store.getChallengeUpdatedEvents(value3.identityHash),
          ]);

          // assert final stored is value with highest nonce
          expect(retrieved0).to.containSubset(value1);
          expect(retrieved3).to.containSubset(value3);
          expect(events3).to.containSubset([value3]);
          expect(events0.sort()).to.containSubset([value0, value1].sort());
          await clearAndClose(store);
        });
      });
    });

    describe("getActiveChallenges", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should be able to retrieve active challenges for a channel`, async () => {
          const store = await createStore(type as StoreTypes);
          const challenge = {
            ...TEST_STORE_APP_CHALLENGE,
            status: StoredAppChallengeStatus.IN_DISPUTE,
          };

          const empty = await store.getActiveChallenges();
          expect(empty.length).to.be.eq(0);

          await store.saveAppChallenge(challenge);
          const vals = await store.getActiveChallenges();
          expect(vals.length).to.be.eq(1);
          expect(vals[0]).to.containSubset(challenge);
          await clearAndClose(store);
        });
      });
    });

    describe("getLatestProcessedBlock / updateLatestProcessedBlock", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should be able to get/update latest processed blocks`, async () => {
          const block = 200;
          const store = await createStore(type as StoreTypes);

          expect(await store.getLatestProcessedBlock()).to.be.eq(0);
          await store.updateLatestProcessedBlock(block);
          expect(await store.getLatestProcessedBlock()).to.be.eq(block);
          await clearAndClose(store);
        });
      });
    });

    describe("getStateProgressedEvents / createStateProgressedEvent", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should be able to get/create state progressed events`, async () => {
          const value = { ...TEST_STORE_STATE_PROGRESSED_EVENT };
          const store = await createStore(type as StoreTypes);

          const empty = await store.getStateProgressedEvents(value.identityHash);
          expect(empty).to.containSubset([]);

          await store.createStateProgressedEvent(value);
          const vals = await store.getStateProgressedEvents(value.identityHash);
          expect(vals.length).to.be.eq(1);
          expect(vals[0]).to.containSubset(value);
          await clearAndClose(store);
        });
      });
    });

    describe("getChallengeUpdatedEvents / createChallengeUpdatedEvent", () => {
      storeTypes.forEach((type) => {
        it(`${type} - should be able to get/create state progressed events`, async () => {
          const value = { ...TEST_STORE_CHALLENGE_UPDATED_EVENT };
          const store = await createStore(type as StoreTypes);

          const empty = await store.getChallengeUpdatedEvents(value.identityHash);
          expect(empty).to.containSubset([]);

          await store.createChallengeUpdatedEvent(value);
          const vals = await store.getChallengeUpdatedEvents(value.identityHash);
          expect(vals.length).to.be.eq(1);
          expect(vals[0]).to.containSubset(value);
          await clearAndClose(store);
        });
      });
    });
  });

});
