import { STORE_SCHEMA_VERSION, ChallengeStatus } from "@connext/types";
import { toBN, toBNJson } from "@connext/utils";

import {
  expect,
  MockBackupService,
  createConnextStore,
  TEST_STORE_ETH_ADDRESS,
  TEST_STORE_CHANNEL,
  TEST_STORE_MINIMAL_TX,
  TEST_STORE_SET_STATE_COMMITMENT,
  TEST_STORE_CONDITIONAL_COMMITMENT,
  TEST_STORE_APP_CHALLENGE,
  TEST_STORE_STATE_PROGRESSED_EVENT,
  TEST_STORE_CHALLENGE_UPDATED_EVENT,
} from "./test-utils";
import { StoreTypes } from "./types";

export const storeTypes = Object.keys(StoreTypes);

describe("ConnextStore", () => {
  const fileDir = "./.test-store";

  describe("getSchemaVersion", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
        const schema = await store.getSchemaVersion();
        expect(schema).to.be.eq(0);
        await store.updateSchemaVersion();
        const updated = await store.getSchemaVersion();
        expect(updated).to.be.eq(STORE_SCHEMA_VERSION);
      });
    });
  });

  describe("createStateChannel + getStateChannel + getSetupCommitment + getSetStateCommitment", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
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

        await store.clear();
      });
    });
  });

  describe("getStateChannelByOwners", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
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
        await store.clear();
      });
    });
  });

  describe("getStateChannelByAppIdentityHash", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
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
        await store.clear();
      });
    });
  });

  describe("createAppInstance + updateAppInstance + getAppInstance + getConditionalTransactionCommitment", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const app = TEST_STORE_CHANNEL.appInstances[0][1];
        const freeBalanceSetState0 = {
          ...TEST_STORE_SET_STATE_COMMITMENT,
          identityHash: channel.freeBalanceAppInstance!.identityHash,
        };
        const freeBalanceSetState1 = {
          ...freeBalanceSetState0,
          versionNumber: toBNJson(app.latestVersionNumber),
        };
        const appSetState = {
          ...TEST_STORE_SET_STATE_COMMITMENT,
          identityHash: app.identityHash,
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
        await store.clear();
      });
    });
  });

  describe("removeAppInstance", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const app = TEST_STORE_CHANNEL.appInstances[0][1];
        const freeBalanceSetState0 = {
          ...TEST_STORE_SET_STATE_COMMITMENT,
          identityHash: channel.freeBalanceAppInstance!.identityHash,
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
        await store.createStateChannel(channel, TEST_STORE_MINIMAL_TX, freeBalanceSetState0);
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
          expect(chan.appInstances).to.deep.eq([]);
          const freeBalance = await store.getSetStateCommitments(
            channel.freeBalanceAppInstance!.identityHash,
          );
          expect(freeBalance.length).to.be.eq(1);
          expect(freeBalance[0]).to.containSubset(freeBalanceSetState2);
        }
        await store.clear();
      });
    });
  });

  describe("createAppProposal + getAppProposal", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
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
        await store.clear();
      });
    });
  });

  describe("removeAppProposal", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
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
        await store.clear();
      });
    });
  });

  describe("getFreeBalance", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
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
        await store.clear();
      });
    });
  });

  describe("clear", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
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
      });
    });
  });

  describe("restore", async () => {
    storeTypes.forEach((type) => {
      it(`${type} - should restore empty state when not provided with a backup service`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
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
        await store.clear();
      });

      it(`${type} - should backup state when provided with a backup service`, async () => {
        const store = await createConnextStore(type as StoreTypes, {
          backupService: new MockBackupService(),
          fileDir,
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
        await store.clear();
      });
    });
  });

  describe("getAppChallenge / createAppChallenge / updateAppChallenge", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should be able to create, get, and update app challenges`, async () => {
        const value = { ...TEST_STORE_APP_CHALLENGE };
        const edited = { ...value, status: ChallengeStatus.NO_CHALLENGE };
        const store = await createConnextStore(type as StoreTypes, { fileDir });

        const empty = await store.getAppChallenge(value.identityHash);
        expect(empty).to.be.undefined;

        // can be called multiple times in a row and preserve the data
        for (let i = 0; i < 3; i++) {
          await store.createAppChallenge(value.identityHash, value);
          expect(await store.getAppChallenge(value.identityHash)).to.containSubset(value);
        }

        await store.updateAppChallenge(value.identityHash, edited);
        expect(await store.getAppChallenge(value.identityHash)).to.containSubset(edited);
        await store.clear();
      });
    });
  });

  describe("getActiveChallenges", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should be able to retrieve active challenges for a channel`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const challenge = { ...TEST_STORE_APP_CHALLENGE };
        const app = TEST_STORE_CHANNEL.appInstances[0][1];
        const freeBalanceSetState0 = {
          ...TEST_STORE_SET_STATE_COMMITMENT,
          identityHash: channel.freeBalanceAppInstance!.identityHash,
        };
        const freeBalanceSetState1 = {
          ...freeBalanceSetState0,
          versionNumber: toBNJson(app.latestVersionNumber),
        };
        const multisigAddress = channel.multisigAddress;
        await store.createStateChannel(channel, TEST_STORE_MINIMAL_TX, freeBalanceSetState0);
        await store.createAppInstance(
          multisigAddress,
          app,
          channel.freeBalanceAppInstance!,
          freeBalanceSetState1,
          TEST_STORE_CONDITIONAL_COMMITMENT,
        );

        const empty = await store.getActiveChallenges(channel.multisigAddress);
        expect(empty.length).to.be.eq(0);

        await store.createAppChallenge(challenge.appStateHash, challenge);
        const vals = await store.getActiveChallenges(channel.multisigAddress);
        expect(vals.length).to.be.eq(1);
        expect(vals[0]).to.containSubset(challenge);
        await store.clear();
      });
    });
  });

  describe("getLatestProcessedBlock / updateLatestProcessedBlock", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should be able to get/update latest processed blocks`, async () => {
        const block = 200;
        const store = await createConnextStore(type as StoreTypes, { fileDir });

        expect(await store.getLatestProcessedBlock()).to.be.eq(0);
        await store.updateLatestProcessedBlock(block);
        expect(await store.getLatestProcessedBlock()).to.be.eq(block);
        await store.clear();
      });
    });
  });

  describe("getStateProgressedEvents / createStateProgressedEvent", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should be able to get/create state progressed events`, async () => {
        const value = { ...TEST_STORE_STATE_PROGRESSED_EVENT };
        const store = await createConnextStore(type as StoreTypes, { fileDir });

        const empty = await store.getStateProgressedEvents(value.identityHash);
        expect(empty).to.containSubset([]);

        await store.createStateProgressedEvent(value.identityHash, value);
        const vals = await store.getStateProgressedEvents(value.identityHash);
        expect(vals.length).to.be.eq(1);
        expect(vals[0]).to.containSubset(value);
        await store.clear();
      });
    });
  });

  describe("getChallengeUpdatedEvents / createChallengeUpdatedEvent", () => {
    storeTypes.forEach((type) => {
      it(`${type} - should be able to get/create challenge updated events`, async () => {
        const value = { ...TEST_STORE_CHALLENGE_UPDATED_EVENT };
        const store = await createConnextStore(type as StoreTypes, { fileDir });

        const empty = await store.getChallengeUpdatedEvents(value.identityHash);
        expect(empty).to.containSubset([]);

        await store.createChallengeUpdatedEvent(value.identityHash, value);
        const vals = await store.getChallengeUpdatedEvents(value.identityHash);
        expect(vals.length).to.be.eq(1);
        expect(vals[0]).to.containSubset(value);
        await store.clear();
      });

      it(`${type} - should be able to process multiple events simultaneously`, async () => {
        const events = [
          { ...TEST_STORE_STATE_PROGRESSED_EVENT },
          { ...TEST_STORE_STATE_PROGRESSED_EVENT, versionNumber: toBN(135) },
        ];
        const store = await createConnextStore(type as StoreTypes, { fileDir });
        await store.clear();
        const empty = await store.getStateProgressedEvents(events[0].identityHash);
        expect(empty).to.be.deep.eq([]);
        await Promise.all(
          events.map((event) => store.createStateProgressedEvent(event.identityHash, event)),
        );
        const retrieved = await store.getStateProgressedEvents(events[0].identityHash);
        expect(retrieved.length).to.be.eq(2);
        const sorted = retrieved.sort((a, b) =>
          toBN(a.versionNumber).sub(toBN(b.versionNumber)).toNumber(),
        );
        sorted.forEach((val, idx) => expect(val).to.containSubset(events[idx]));
        await store.clear();
      });
    });
  });
});
