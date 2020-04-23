import { StoreTypes, STORE_SCHEMA_VERSION } from "@connext/types";
import {
  expect,
  MockBackupService,
  createConnextStore,
  env,
  TEST_STORE_ETH_ADDRESS,
  TEST_STORE_CHANNEL,
  TEST_STORE_MINIMAL_TX,
  TEST_STORE_SET_STATE_COMMITMENT,
  TEST_STORE_CONDITIONAL_COMMITMENT,
} from "../util";

export const storeTypes = Object.keys(StoreTypes);

describe("ConnextStore", () => {
  const fileDir = env.storeDir;

  describe("getSchemaVersion", () => {
    storeTypes.forEach(type => {
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
    storeTypes.forEach(type => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
        await store.updateSchemaVersion();
        const channel = TEST_STORE_CHANNEL;
        const nullValue = await store.getStateChannel(channel.multisigAddress);
        expect(nullValue).to.be.undefined;
        await store.createStateChannel(
          channel,
          TEST_STORE_MINIMAL_TX,
          TEST_STORE_SET_STATE_COMMITMENT,
        );
        const retrieved = await store.getStateChannel(channel.multisigAddress);
        expect(retrieved).to.deep.eq(channel);

        const setup = await store.getSetupCommitment(channel.multisigAddress);
        expect(setup).to.containSubset(TEST_STORE_MINIMAL_TX);

        const setState = await store.getSetStateCommitment(
          channel.freeBalanceAppInstance!.identityHash,
        );
        expect(setState).to.containSubset(TEST_STORE_SET_STATE_COMMITMENT);

        // edit channel
        await store.createStateChannel(
          { ...channel, monotonicNumProposedApps: 14 },
          TEST_STORE_MINIMAL_TX,
          TEST_STORE_SET_STATE_COMMITMENT,
        );
        const edited = await store.getStateChannel(channel.multisigAddress);
        expect(edited).to.deep.eq({ ...channel, monotonicNumProposedApps: 14 });
        await store.clear();
      });
    });
  });

  describe("getStateChannelByOwners", () => {
    storeTypes.forEach(type => {
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
    storeTypes.forEach(type => {
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

  describe("createAppInstance + updateAppInstance + getAppInstance", () => {
    storeTypes.forEach(type => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const app = TEST_STORE_CHANNEL.appInstances[0][1];
        const multisigAddress = channel.multisigAddress;
        await store.createStateChannel(
          channel,
          TEST_STORE_MINIMAL_TX,
          TEST_STORE_SET_STATE_COMMITMENT,
        );
        const edited = { ...app, latestVersionNumber: 14 };
        await store.createAppInstance(
          multisigAddress,
          app,
          channel.freeBalanceAppInstance!,
          TEST_STORE_SET_STATE_COMMITMENT,
          TEST_STORE_CONDITIONAL_COMMITMENT,
        );
        const retrieved = await store.getAppInstance(app.identityHash);
        expect(retrieved).to.deep.eq(app);
        const freeBalance = await store.getSetStateCommitment(
          channel.freeBalanceAppInstance!.identityHash,
        );
        expect(freeBalance).to.containSubset(TEST_STORE_SET_STATE_COMMITMENT);
        await store.updateAppInstance(multisigAddress, edited, {
          ...TEST_STORE_SET_STATE_COMMITMENT,
          versionNumber: 12,
        });
        const editedRetrieved = await store.getAppInstance(app.identityHash);
        expect(editedRetrieved).to.deep.eq(edited);
        const updatedState = await store.getSetStateCommitment(app.identityHash);
        expect(updatedState).to.containSubset({
          ...TEST_STORE_SET_STATE_COMMITMENT,
          versionNumber: 12,
        });

        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.appInstances).to.deep.eq([[app.identityHash, edited]]);
        await store.clear();
      });
    });
  });

  describe("removeAppInstance", () => {
    storeTypes.forEach(type => {
      it(`${type} - should work`, async () => {
        const store = await createConnextStore(type as StoreTypes, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const app = TEST_STORE_CHANNEL.appInstances[0][1];
        const multisigAddress = channel.multisigAddress;
        await store.createStateChannel(
          channel,
          TEST_STORE_MINIMAL_TX,
          TEST_STORE_SET_STATE_COMMITMENT,
        );
        await store.createAppInstance(
          multisigAddress,
          app,
          channel.freeBalanceAppInstance!,
          TEST_STORE_SET_STATE_COMMITMENT,
          TEST_STORE_CONDITIONAL_COMMITMENT,
        );
        await store.removeAppInstance(
          multisigAddress,
          app.identityHash,
          channel.freeBalanceAppInstance!,
          { ...TEST_STORE_SET_STATE_COMMITMENT, versionNumber: 1337 },
        );
        const retrieved = await store.getAppInstance(app.identityHash);
        expect(retrieved).to.be.undefined;
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.appInstances).to.deep.eq([]);
        const freeBalance = await store.getSetStateCommitment(
          channel.freeBalanceAppInstance!.identityHash,
        );
        expect(freeBalance).to.containSubset({
          ...TEST_STORE_SET_STATE_COMMITMENT,
          versionNumber: 1337,
        });
        await store.clear();
      });
    });
  });

  describe("getAppProposal", () => {
    storeTypes.forEach(type => {
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
        const nullValue = await store.getAppProposal(proposal.identityHash);
        expect(nullValue).to.be.undefined;
        await store.createAppProposal(
          multisigAddress,
          proposal,
          channel.monotonicNumProposedApps,
          TEST_STORE_SET_STATE_COMMITMENT,
        );
        const retrieved = await store.getAppProposal(proposal.identityHash);
        expect(retrieved).to.deep.eq(proposal);
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.proposedAppInstances).to.deep.eq([[proposal.identityHash, proposal]]);
        await store.clear();
      });
    });
  });

  describe("createAppProposal", () => {
    storeTypes.forEach(type => {
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
        const retrieved = await store.getAppProposal(proposal.identityHash);
        expect(retrieved).to.deep.eq(proposal);
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.monotonicNumProposedApps).to.be.eq(channel.monotonicNumProposedApps);
        expect(chan.proposedAppInstances).to.deep.eq([[proposal.identityHash, proposal]]);
        await store.clear();
      });
    });
  });

  describe("removeAppProposal", () => {
    storeTypes.forEach(type => {
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
        await store.removeAppProposal(multisigAddress, proposal.identityHash);
        const retrieved = await store.getAppProposal(proposal.identityHash);
        expect(retrieved).to.be.undefined;
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.proposedAppInstances).to.deep.eq([]);
        await store.clear();
      });
    });
  });

  describe("getFreeBalance", () => {
    storeTypes.forEach(type => {
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
    storeTypes.forEach(type => {
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
    storeTypes.forEach(type => {
      if (type === StoreTypes.Memory) {
        return;
      }

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
      });
    });
  });
});
