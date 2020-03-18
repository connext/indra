import {
  expect,
  MockBackupService,
  createConnextStore,
  env,
  TEST_STORE_ETH_ADDRESS,
  TEST_STORE_CHANNEL,
  TEST_STORE_APP_INSTANCE,
  TEST_STORE_MINIMAL_TX,
  TEST_STORE_SET_STATE_COMMITMENT,
  TEST_STORE_CONDITIONAL_COMMITMENT,
} from "../util";
import { StoreTypes, StoreType, MEMORYSTORAGE, STORE_SCHEMA_VERSION } from "@connext/types";

describe("ConnextStore", () => {
  const fileDir = env.storeDir;

  describe("getSchemaVersion", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const schema = await store.getSchemaVersion();
        expect(schema).to.containSubset(STORE_SCHEMA_VERSION);
        await store.clear();
      });
    });
  });

  describe("getStateChannel", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = TEST_STORE_CHANNEL;
        await store.saveStateChannel(channel);
        const retrieved = await store.getStateChannel(channel.multisigAddress);
        expect(retrieved).to.deep.eq(channel);
        await store.clear();
      });
    });
  });

  describe("saveStateChannel", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = TEST_STORE_CHANNEL;
        const nullValue = await store.getStateChannel(channel.multisigAddress);
        expect(nullValue).to.be.undefined;
        await store.saveStateChannel(channel);
        const retrieved = await store.getStateChannel(channel.multisigAddress);
        expect(retrieved).to.deep.eq(channel);
        // edit channel
        await store.saveStateChannel({ ...channel, monotonicNumProposedApps: 14 });
        const edited = await store.getStateChannel(channel.multisigAddress);
        expect(edited).to.deep.eq({ ...channel, monotonicNumProposedApps: 14 });
        await store.clear();
      });
    });
  });

  describe("getStateChannelByOwners", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = TEST_STORE_CHANNEL;
        const owners = channel.userNeuteredExtendedKeys;
        const nullValue = await store.getStateChannelByOwners(owners);
        expect(nullValue).to.be.undefined;
        await store.saveStateChannel(channel);
        const retrieved = await store.getStateChannelByOwners(owners);
        expect(retrieved).to.deep.eq(channel);
        await store.clear();
      });
    });
  });

  describe("getStateChannelByAppInstanceId", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = TEST_STORE_CHANNEL;
        const appInstanceId = channel.appInstances[0][0];
        const nullValue = await store.getStateChannelByAppInstanceId(appInstanceId);
        expect(nullValue).to.be.undefined;
        await store.saveStateChannel(channel);
        const retrieved = await store.getStateChannelByAppInstanceId(appInstanceId);
        expect(retrieved).to.deep.eq(channel);
        await store.clear();
      });
    });
  });

  describe("getAppInstance", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const app = TEST_STORE_CHANNEL.appInstances[0][1];
        const multisigAddress = channel.multisigAddress;
        await store.saveStateChannel(channel);
        const nullValue = await store.getAppInstance(app.identityHash);
        expect(nullValue).to.be.undefined;
        await store.saveAppInstance(multisigAddress, app);
        const retrieved = await store.getAppInstance(app.identityHash);
        expect(retrieved).to.deep.eq(app);
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.appInstances).to.deep.eq([[app.identityHash, app]]);
        await store.clear();
      });
    });
  });

  describe("saveAppInstance", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const app = TEST_STORE_CHANNEL.appInstances[0][1];
        const multisigAddress = channel.multisigAddress;
        await store.saveStateChannel(channel);
        const edited = { ...app, latestVersionNumber: 14 };
        await store.saveAppInstance(multisigAddress, app);
        const retrieved = await store.getAppInstance(app.identityHash);
        expect(retrieved).to.deep.eq(app);
        await store.saveAppInstance(multisigAddress, edited);
        const editedRetrieved = await store.getAppInstance(app.identityHash);
        expect(editedRetrieved).to.deep.eq(edited);
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.appInstances).to.deep.eq([[app.identityHash, edited]]);
        await store.clear();
      });
    });
  });

  describe("removeAppInstance", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const app = TEST_STORE_CHANNEL.appInstances[0][1];
        const multisigAddress = channel.multisigAddress;
        await store.saveStateChannel(channel);
        await store.saveAppInstance(multisigAddress, app);
        await store.removeAppInstance(multisigAddress, app.identityHash);
        const retrieved = await store.getAppInstance(app.identityHash);
        expect(retrieved).to.be.undefined;
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.appInstances).to.deep.eq([]);
        await store.clear();
      });
    });
  });

  describe("getAppProposal", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const proposal = TEST_STORE_CHANNEL.proposedAppInstances[0][1];
        const multisigAddress = channel.multisigAddress;
        await store.saveStateChannel(channel);
        const nullValue = await store.getAppProposal(proposal.identityHash);
        expect(nullValue).to.be.undefined;
        await store.saveAppProposal(multisigAddress, proposal);
        const retrieved = await store.getAppProposal(proposal.identityHash);
        expect(retrieved).to.deep.eq(proposal);
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.proposedAppInstances).to.deep.eq([[proposal.identityHash, proposal]]);
        await store.clear();
      });
    });
  });

  describe("saveAppProposal", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const proposal = TEST_STORE_CHANNEL.proposedAppInstances[0][1];
        const multisigAddress = channel.multisigAddress;
        await store.saveStateChannel(channel);
        const edited = { ...proposal, appSeqNo: 17 };
        await store.saveAppProposal(multisigAddress, proposal);
        const retrieved = await store.getAppProposal(proposal.identityHash);
        expect(retrieved).to.deep.eq(proposal);
        await store.saveAppProposal(multisigAddress, edited);
        const editedRetrieved = await store.getAppProposal(proposal.identityHash);
        expect(editedRetrieved).to.deep.eq(edited);
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.proposedAppInstances).to.deep.eq([[proposal.identityHash, edited]]);
        await store.clear();
      });
    });
  });

  describe("removeAppProposal", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const proposal = TEST_STORE_CHANNEL.proposedAppInstances[0][1];
        const multisigAddress = channel.multisigAddress;
        await store.saveStateChannel(channel);
        await store.saveAppProposal(multisigAddress, proposal);
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
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const freeBalance = channel.freeBalanceAppInstance!;
        const multisigAddress = channel.multisigAddress;
        const nullValue = await store.getFreeBalance(multisigAddress);
        expect(nullValue).to.deep.eq(undefined);
        await store.saveStateChannel(channel);
        await store.saveFreeBalance(multisigAddress, freeBalance);
        const retrieved = await store.getFreeBalance(multisigAddress);
        expect(retrieved).to.deep.eq(freeBalance);
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.freeBalanceAppInstance).to.deep.eq(freeBalance);
        await store.clear();
      });
    });
  });

  describe("saveFreeBalance", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const channel = { ...TEST_STORE_CHANNEL, appInstances: [], proposedAppInstances: [] };
        const freeBalance = channel.freeBalanceAppInstance!;
        const multisigAddress = channel.multisigAddress;
        const edited = { ...freeBalance, latestVersionNumber: 8 };
        await store.saveStateChannel(channel);
        await store.saveFreeBalance(multisigAddress, freeBalance);
        const retrieved = await store.getFreeBalance(multisigAddress);
        expect(retrieved).to.deep.eq(freeBalance);
        await store.saveFreeBalance(multisigAddress, edited);
        const editedRetrieved = await store.getFreeBalance(multisigAddress);
        expect(editedRetrieved).to.deep.eq(edited);
        const chan = await store.getStateChannel(multisigAddress);
        expect(chan.freeBalanceAppInstance).to.deep.eq(edited);
        await store.clear();
      });
    });
  });

  describe("getSetupCommitment", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const setup = TEST_STORE_MINIMAL_TX;
        const multisigAddress = TEST_STORE_ETH_ADDRESS;
        expect(await store.getSetupCommitment(multisigAddress)).to.be.undefined;
        await store.saveSetupCommitment(multisigAddress, setup);
        const retrieved = await store.getSetupCommitment(multisigAddress);
        expect(retrieved).to.containSubset(setup);
        await store.clear();
      });
    });
  });

  describe("saveSetupCommitment", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const setup = TEST_STORE_MINIMAL_TX;
        const edited = { ...TEST_STORE_MINIMAL_TX, value: 5 };
        const multisigAddress = TEST_STORE_ETH_ADDRESS;
        await store.saveSetupCommitment(multisigAddress, setup);
        const retrieved = await store.getSetupCommitment(multisigAddress);
        expect(retrieved).to.containSubset(setup);
        await store.saveSetupCommitment(multisigAddress, edited);
        const editedRetrieved = await store.getSetupCommitment(multisigAddress);
        expect(editedRetrieved).to.containSubset(edited);
        await store.clear();
      });
    });
  });

  describe("getLatestSetStateCommitment", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const setState = TEST_STORE_SET_STATE_COMMITMENT;
        const appIdentityHash = TEST_STORE_APP_INSTANCE.identityHash;
        expect(await store.getLatestSetStateCommitment(appIdentityHash)).to.be.undefined;
        await store.saveLatestSetStateCommitment(appIdentityHash, setState);
        const retrieved = await store.getLatestSetStateCommitment(appIdentityHash);
        expect(retrieved).to.containSubset(setState);
        await store.clear();
      });
    });
  });

  describe("saveLatestSetStateCommitment", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const setState = TEST_STORE_SET_STATE_COMMITMENT;
        const edited = { ...TEST_STORE_SET_STATE_COMMITMENT, versionNumber: 9 };
        const appIdentityHash = TEST_STORE_APP_INSTANCE.identityHash;
        await store.saveLatestSetStateCommitment(appIdentityHash, setState);
        const retrieved = await store.getLatestSetStateCommitment(appIdentityHash);
        expect(retrieved).to.containSubset(setState);
        await store.saveLatestSetStateCommitment(appIdentityHash, edited);
        const editedRetrieved = await store.getLatestSetStateCommitment(appIdentityHash);
        expect(editedRetrieved).to.containSubset(edited);
        await store.clear();
      });
    });
  });

  describe("getConditionalTransactionCommitment", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const setState = TEST_STORE_SET_STATE_COMMITMENT;
        const appIdentityHash = TEST_STORE_APP_INSTANCE.identityHash;
        expect(await store.getLatestSetStateCommitment(appIdentityHash)).to.be.undefined;
        await store.saveLatestSetStateCommitment(appIdentityHash, setState);
        const retrieved = await store.getLatestSetStateCommitment(appIdentityHash);
        expect(retrieved).to.containSubset(setState);
        await store.clear();
      });
    });
  });

  describe("saveConditionalTransactionCommitment", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const conditional = TEST_STORE_CONDITIONAL_COMMITMENT;
        const edited = { ...conditional, freeBalanceAppIdentityHash: "0xtesting" };
        const appIdentityHash = TEST_STORE_APP_INSTANCE.identityHash;
        await store.saveConditionalTransactionCommitment(appIdentityHash, conditional);
        const retrieved = await store.getConditionalTransactionCommitment(appIdentityHash);
        expect(retrieved).to.containSubset(conditional);
        await store.saveConditionalTransactionCommitment(appIdentityHash, edited);
        const editedRetrieved = await store.getConditionalTransactionCommitment(appIdentityHash);
        expect(editedRetrieved).to.containSubset(edited);
        await store.clear();
      });
    });
  });

  describe("getWithdrawalCommitment", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const withdraw = TEST_STORE_MINIMAL_TX;
        const multisigAddress = TEST_STORE_ETH_ADDRESS;
        expect(await store.getWithdrawalCommitment(multisigAddress)).to.be.undefined;
        await store.saveWithdrawalCommitment(multisigAddress, withdraw);
        const retrieved = await store.getWithdrawalCommitment(multisigAddress);
        expect(retrieved).to.containSubset(withdraw);
        await store.clear();
      });
    });
  });

  describe("saveWithdrawalCommitment", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const withdraw = TEST_STORE_MINIMAL_TX;
        const edited = { ...TEST_STORE_MINIMAL_TX, value: 5 };
        const multisigAddress = TEST_STORE_ETH_ADDRESS;
        await store.saveWithdrawalCommitment(multisigAddress, withdraw);
        const retrieved = await store.getWithdrawalCommitment(multisigAddress);
        expect(retrieved).to.containSubset(withdraw);
        await store.saveWithdrawalCommitment(multisigAddress, edited);
        const editedRetrieved = await store.getWithdrawalCommitment(multisigAddress);
        expect(editedRetrieved).to.containSubset(edited);
        await store.clear();
      });
    });
  });

  describe("clear", () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const multisigAddress = TEST_STORE_ETH_ADDRESS;
        await store.saveStateChannel(TEST_STORE_CHANNEL);
        const retrieved = await store.getStateChannel(multisigAddress);
        expect(retrieved).to.containSubset(TEST_STORE_CHANNEL);
        await store.clear();
        expect(await store.getStateChannel(multisigAddress)).to.containSubset(undefined);
      });
    });
  });

  describe("restore", async () => {
    Object.keys(StoreTypes).forEach(type => {
      it(`${type} - should restore empty state when not provided with a backup service`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const multisigAddress = TEST_STORE_ETH_ADDRESS;
        await store.saveStateChannel(TEST_STORE_CHANNEL);
        const retrieved = await store.getStateChannel(multisigAddress);
        expect(retrieved).to.containSubset(TEST_STORE_CHANNEL);

        await expect(store.restore()).to.be.rejectedWith(`No backup provided, store cleared`);
        expect(await store.getStateChannel(multisigAddress)).to.containSubset(undefined);
      });

      if (type === MEMORYSTORAGE) {
        return;
      }

      it(`${type} - should backup state when provided with a backup service`, async () => {
        const store = createConnextStore(type as StoreType, {
          backupService: new MockBackupService(),
          fileDir,
        });
        const multisigAddress = TEST_STORE_ETH_ADDRESS;
        await store.saveStateChannel(TEST_STORE_CHANNEL);
        const retrieved = await store.getStateChannel(multisigAddress);
        expect(retrieved).to.containSubset(TEST_STORE_CHANNEL);
        await store.restore();
        expect(await store.getStateChannel(multisigAddress)).to.containSubset(TEST_STORE_CHANNEL);
      });
    });
  });
});
