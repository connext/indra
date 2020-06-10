import { EventEmitter } from "events";
import {
  JsonRpcProvider,
  IStoreService,
  EventNames,
  StateChannelJSON,
  ProtocolNames,
  MethodNames,
  MethodParams,
} from "@connext/types";
import { getMemoryStore } from "@connext/store";
import { utils } from "ethers";

import { env } from "../setup";
import { CFCore } from "../../cfCore";
import {
  createChannel,
  makeProposeCall,
  constructInstallRpc,
  makeAndSendProposeCall,
  installApp,
  constructUninstallRpc,
  constructTakeActionRpc,
  uninstallApp,
} from "../utils";
import { MemoryMessagingServiceWithLimits } from "../services/memory-messaging-service-limits";
import { deBigNumberifyJson, ChannelSigner, delay, stringify } from "@connext/utils";
import { A_PRIVATE_KEY, B_PRIVATE_KEY } from "../test-constants.jest";
import { TestContractAddresses } from "../contracts";
import { MemoryLockService } from "../services";
import { Logger } from "../logger";
import { validAction } from "../tic-tac-toe";

const { isHexString } = utils;

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

describe("Sync", () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;
  let storeServiceA: IStoreService;
  let storeServiceB: IStoreService;
  let sharedEventEmitter: EventEmitter;
  let ethUrl: string;
  let provider: JsonRpcProvider;
  let nodeConfig: any;
  let lockService: MemoryLockService;
  let channelSignerA: ChannelSigner;
  let channelSignerB: ChannelSigner;
  let expectedChannel: StateChannelJSON | undefined;
  let messagingServiceA: MemoryMessagingServiceWithLimits;
  let messagingServiceB: MemoryMessagingServiceWithLimits;

  const log = new Logger("SyncTest", env.logLevel, true);

  beforeEach(async () => {
    // test global fixtures
    sharedEventEmitter = new EventEmitter();
    ethUrl = global["wallet"]["provider"].connection.url;
    provider = new JsonRpcProvider(ethUrl);
    nodeConfig = { STORE_KEY_PREFIX: "test" };
    lockService = new MemoryLockService();

    // create nodeA values
    storeServiceA = getMemoryStore();
    channelSignerA = new ChannelSigner(A_PRIVATE_KEY, ethUrl);
    await storeServiceA.init();
    await storeServiceA.clear();

    // create nodeB values
    messagingServiceB = new MemoryMessagingServiceWithLimits(
      sharedEventEmitter,
      undefined,
      undefined,
      undefined,
      "NodeB",
    );
    storeServiceB = getMemoryStore();
    channelSignerB = new ChannelSigner(B_PRIVATE_KEY, ethUrl);
    await storeServiceB.init();
    nodeB = await CFCore.create(
      messagingServiceB,
      storeServiceB,
      global["contracts"],
      nodeConfig,
      provider,
      channelSignerB,
      lockService,
      0,
      new Logger("CreateClient", env.logLevel, true, "B"),
    );
  }, 30_000);

  describe("Sync::propose", () => {
    let identityHash: string;
    beforeEach(async () => {
      // propose-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(sharedEventEmitter, 0, "propose");
      nodeA = await CFCore.create(
        messagingServiceA,
        storeServiceA,
        global["contracts"],
        nodeConfig,
        provider,
        channelSignerA,
        lockService,
        0,
        new Logger("CreateClient", env.logLevel, true, "A"),
      );

      // create channel
      multisigAddress = await createChannel(nodeA, nodeB);

      // load stores with proposal
      const rpc = makeProposeCall(nodeA, TicTacToeApp, multisigAddress);
      await new Promise(async (res) => {
        nodeA.once("PROPOSE_INSTALL_EVENT", res);
        try {
          await nodeB.rpcRouter.dispatch({
            ...rpc,
            parameters: deBigNumberifyJson(rpc.parameters),
          });
        } catch (e) {
          log.info(`Caught error sending rpc: ${e.message}`);
        }
      });

      // get expected channel from nodeB
      expect(isHexString(multisigAddress)).toBe(true);
      expectedChannel = await storeServiceA.getStateChannel(multisigAddress);
      identityHash = expectedChannel!.proposedAppInstances[0][0];
      const unsynced = await storeServiceB.getStateChannel(multisigAddress);
      expect(expectedChannel).toBeDefined();
      expect(expectedChannel!.proposedAppInstances.length).toBe(1);
      expect(unsynced?.proposedAppInstances.length).toBe(0);
      messagingServiceA.clearLimits();
    });

    test("sync protocol responder is missing a proposal held by the protocol initiator", async () => {
      const [eventData, newNodeA] = await Promise.all([
        new Promise(async (resolve, reject) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
          nodeB.on(EventNames.SYNC_FAILED_EVENT, () => reject(`Sync failed`));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerA,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "A"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeA.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);
      await (newNodeA as CFCore).rpcRouter.dispatch(
        constructInstallRpc(identityHash, multisigAddress),
      );
      const newAppInstanceA = await storeServiceA.getAppInstance(identityHash);
      const newAppInstanceB = await storeServiceB.getAppInstance(identityHash);
      const newChannelA = await storeServiceA.getStateChannel(multisigAddress);
      const newChannelB = await storeServiceB.getStateChannel(multisigAddress);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newAppInstanceA!).toMatchObject(newAppInstanceB!);
      expect(newAppInstanceA!.identityHash).toBe(identityHash);
      expect(newAppInstanceA!.appSeqNo).toBe(2);
      expect(newAppInstanceA!.latestVersionNumber).toBe(1);
      expect(newChannelA!.freeBalanceAppInstance!.latestVersionNumber).toBe(2);
      expect(newChannelA!.monotonicNumProposedApps).toBe(2);
      expect(newChannelA!.appInstances.length).toBe(1);
    }, 30_000);

    test("sync protocol initiator is missing a proposal held by the protocol responder", async () => {
      const [eventData, newNodeB] = await Promise.all([
        new Promise(async (resolve, reject) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
          nodeA.on(EventNames.SYNC_FAILED_EVENT, (data) => reject(`Sync failed`));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerB,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "B"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeB.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);
      await (newNodeB as CFCore).rpcRouter.dispatch(
        constructInstallRpc(identityHash, multisigAddress),
      );
      const newAppInstanceA = await storeServiceA.getAppInstance(identityHash);
      const newAppInstanceB = await storeServiceB.getAppInstance(identityHash);
      const newChannelA = await storeServiceA.getStateChannel(multisigAddress);
      const newChannelB = await storeServiceB.getStateChannel(multisigAddress);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newAppInstanceA!).toMatchObject(newAppInstanceB!);
      expect(newAppInstanceB!.identityHash).toBe(identityHash);
      expect(newAppInstanceB!.appSeqNo).toBe(2);
      expect(newAppInstanceB!.latestVersionNumber).toBe(1);
      expect(newChannelB!.freeBalanceAppInstance!.latestVersionNumber).toBe(2);
      expect(newChannelB!.monotonicNumProposedApps).toBe(2);
      expect(newChannelB!.appInstances.length).toBe(1);
    }, 30_000);
  });

  describe("Sync::propose + rejectInstall", () => {
    let proposedAppIdentityHash: string;
    beforeEach(async () => {
      // propose-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(sharedEventEmitter, 0, "propose");
      nodeA = await CFCore.create(
        messagingServiceA,
        storeServiceA,
        global["contracts"],
        nodeConfig,
        provider,
        channelSignerA,
        lockService,
        0,
        new Logger("CreateClient", env.logLevel, true, "A"),
      );

      // create channel
      multisigAddress = await createChannel(nodeA, nodeB);

      // load stores with proposal
      const rpc = makeProposeCall(nodeA, TicTacToeApp, multisigAddress);
      const res: any = await new Promise(async (res) => {
        nodeA.once("PROPOSE_INSTALL_EVENT", res);
        try {
          await nodeB.rpcRouter.dispatch({
            ...rpc,
            parameters: deBigNumberifyJson(rpc.parameters),
          });
        } catch (e) {
          log.info(`Caught error sending rpc: ${e.message}`);
        }
      });
      proposedAppIdentityHash = res.data.appInstanceId;

      // get expected channel from nodeB
      expect(isHexString(multisigAddress)).toBe(true);
      expectedChannel = await storeServiceA.getStateChannel(multisigAddress);
      const unsynced = await storeServiceB.getStateChannel(multisigAddress);
      expect(expectedChannel).toBeDefined();
      expect(expectedChannel!.proposedAppInstances.length).toBe(1);
      expect(unsynced?.proposedAppInstances.length).toBe(0);

      await nodeA.rpcRouter.dispatch({
        methodName: MethodNames.chan_rejectInstall,
        parameters: {
          appIdentityHash: proposedAppIdentityHash,
          multisigAddress,
        } as MethodParams.RejectInstall,
      });

      expectedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(expectedChannel!.proposedAppInstances.length).toBe(0);

      messagingServiceA.clearLimits();
    }, 30_000);

    test("sync protocol responder is missing a proposal held by the protocol initiator", async () => {
      const [eventData, newNodeA] = await Promise.all([
        new Promise(async (resolve, reject) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
          nodeB.on(EventNames.SYNC_FAILED_EVENT, () => reject(`Sync failed`));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerA,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "A"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeA.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);

      const rpc = makeProposeCall(newNodeA as CFCore, TicTacToeApp, multisigAddress);
      const res: any = await new Promise(async (resolve) => {
        (newNodeA as CFCore).once("PROPOSE_INSTALL_EVENT", resolve);
        try {
          await nodeB.rpcRouter.dispatch({
            ...rpc,
            parameters: deBigNumberifyJson(rpc.parameters),
          });
        } catch (e) {
          log.info(`Caught error sending rpc: ${e.message}`);
        }
      });

      const newAppInstanceA = await storeServiceA.getAppProposal(res.data.appInstanceId);
      const newAppInstanceB = await storeServiceB.getAppProposal(res.data.appInstanceId);
      const newChannelA = await storeServiceA.getStateChannel(multisigAddress);
      const newChannelB = await storeServiceB.getStateChannel(multisigAddress);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newAppInstanceA!).toMatchObject(newAppInstanceB!);
      expect(newAppInstanceB!.identityHash).toBe(res.data.appInstanceId);
      expect(newAppInstanceB!.appSeqNo).toBe(3);
      expect(newAppInstanceB!.latestVersionNumber).toBe(1);
      expect(newChannelB!.freeBalanceAppInstance!.latestVersionNumber).toBe(1);
      expect(newChannelB!.monotonicNumProposedApps).toBe(3);
      expect(newChannelB!.proposedAppInstances.length).toBe(1);
    }, 30_000);

    test("sync protocol initiator is missing a proposal held by the protocol responder", async () => {
      const [eventData, newNodeB] = await Promise.all([
        new Promise(async (resolve, reject) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
          nodeA.on(EventNames.SYNC_FAILED_EVENT, (data) => reject(`Sync failed`));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerB,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "B"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: (newNodeB as CFCore).publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);

      const rpc = makeProposeCall(nodeA, TicTacToeApp, multisigAddress);
      const res: any = await new Promise(async (resolve) => {
        nodeA.once("PROPOSE_INSTALL_EVENT", resolve);
        try {
          await (newNodeB as CFCore).rpcRouter.dispatch({
            ...rpc,
            parameters: deBigNumberifyJson(rpc.parameters),
          });
        } catch (e) {
          log.info(`Caught error sending rpc: ${e.message}`);
        }
      });

      const newAppInstanceA = await storeServiceA.getAppProposal(res.data.appInstanceId);
      const newAppInstanceB = await storeServiceB.getAppProposal(res.data.appInstanceId);
      const newChannelA = await storeServiceA.getStateChannel(multisigAddress);
      const newChannelB = await storeServiceB.getStateChannel(multisigAddress);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newAppInstanceA!).toMatchObject(newAppInstanceB!);
      expect(newAppInstanceB!.identityHash).toBe(res.data.appInstanceId);
      expect(newAppInstanceB!.appSeqNo).toBe(3);
      expect(newAppInstanceB!.latestVersionNumber).toBe(1);
      expect(newChannelB!.freeBalanceAppInstance!.latestVersionNumber).toBe(1);
      expect(newChannelB!.monotonicNumProposedApps).toBe(3);
      expect(newChannelB!.proposedAppInstances.length).toBe(1);
    }, 30_000);
  });

  describe("Sync::install", () => {
    let appIdentityHash;
    let unsynced;
    // TODO: figure out how to fast-forward IO_SEND_AND_WAIT
    beforeEach(async () => {
      // install-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(
        sharedEventEmitter,
        0,
        ProtocolNames.install,
        "send",
      );
      nodeA = await CFCore.create(
        messagingServiceA,
        storeServiceA,
        global["contracts"],
        nodeConfig,
        provider,
        channelSignerA,
        lockService,
        0,
        new Logger("CreateClient", env.logLevel, true, "A"),
      );

      // create channel
      multisigAddress = await createChannel(nodeA, nodeB);

      // create proposal
      const [ret] = await Promise.all([
        makeAndSendProposeCall(nodeA, nodeB, TicTacToeApp, multisigAddress),
        new Promise((resolve) => {
          nodeB.once(EventNames.PROPOSE_INSTALL_EVENT, () => {
            resolve();
          });
        }),
      ]);
      appIdentityHash = (ret as any).appIdentityHash;

      await new Promise(async (res, rej) => {
        nodeA.once(EventNames.INSTALL_EVENT, res);
        try {
          await nodeB.rpcRouter.dispatch(constructInstallRpc(appIdentityHash, multisigAddress));
          rej(`Node B should not complete installation`);
        } catch (e) {
          log.info(`Caught error sending rpc: ${e.message}`);
        }
      });

      // get expected channel from nodeB
      expectedChannel = (await storeServiceA.getStateChannel(multisigAddress))!;
      unsynced = await storeServiceB.getStateChannel(multisigAddress);
      expect(unsynced?.appInstances.length).toBe(0);
      expect(expectedChannel?.appInstances.length).toBe(1);
      messagingServiceA.clearLimits();
    }, 30_000);

    test("sync protocol -- initiator is missing an app held by responder", async () => {
      const [eventData, newNodeB] = await Promise.all([
        new Promise(async (resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerB,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "B"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeB.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);

      await uninstallApp(newNodeB as CFCore, nodeA, appIdentityHash, multisigAddress);
      const newChannelA = await storeServiceA.getStateChannel(multisigAddress);
      const newChannelB = await storeServiceB.getStateChannel(multisigAddress);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newChannelA!.appInstances.length).toBe(0);
      expect(newChannelA!.freeBalanceAppInstance!.latestVersionNumber).toBe(3);
      expect(newChannelA!.monotonicNumProposedApps).toBe(2);
    }, 30_000);

    test("sync protocol -- responder is missing an app held by initiator", async () => {
      const [eventData, newNodeA] = await Promise.all([
        new Promise(async (resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerA,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "A"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeA.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);

      await uninstallApp(nodeB, newNodeA as CFCore, appIdentityHash, multisigAddress);
      const newChannelA = await storeServiceA.getStateChannel(multisigAddress);
      const newChannelB = await storeServiceB.getStateChannel(multisigAddress);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newChannelB!.appInstances.length).toBe(0);
      expect(newChannelB!.freeBalanceAppInstance!.latestVersionNumber).toBe(3);
      expect(newChannelB!.monotonicNumProposedApps).toBe(2);
    }, 30_000);
  });

  describe("Sync::uninstall", () => {
    let identityHash: string;
    beforeEach(async () => {
      // uninstall-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(
        sharedEventEmitter,
        0,
        ProtocolNames.uninstall,
        "send",
      );
      nodeA = await CFCore.create(
        messagingServiceA,
        storeServiceA,
        global["contracts"],
        nodeConfig,
        provider,
        channelSignerA,
        lockService,
        0,
        new Logger("CreateClient", env.logLevel, true, "A"),
      );

      // create channel
      multisigAddress = await createChannel(nodeA, nodeB);

      // create app
      [identityHash] = await installApp(nodeA, nodeB, multisigAddress, TicTacToeApp);

      // nodeB should respond to the uninstall, nodeA will not get the
      // message, but nodeB thinks its sent
      await new Promise(async (resolve, reject) => {
        nodeA.once(EventNames.UNINSTALL_EVENT, () => resolve);
        try {
          await nodeB.rpcRouter.dispatch(constructUninstallRpc(identityHash, multisigAddress));
          return reject(`Node B should be able to complete uninstall`);
        } catch (e) {
          return resolve();
        }
      });

      // get expected channel from nodeB
      expectedChannel = (await storeServiceA.getStateChannel(multisigAddress))!;
      const unsynced = await storeServiceB.getStateChannel(multisigAddress);
      expect(expectedChannel.appInstances.length).toBe(0);
      expect(unsynced?.appInstances.length).toBe(1);
      messagingServiceA.clearLimits();
    }, 30_000);

    test("sync protocol -- initiator has an app uninstalled by responder", async () => {
      await messagingServiceB.disconnect();
      const [eventData, newNodeB] = await Promise.all([
        new Promise(async (resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerB,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "B"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeB.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);

      // create new app
      [identityHash] = await installApp(newNodeB as CFCore, nodeA, multisigAddress, TicTacToeApp);
      const [newAppInstanceA, newAppInstanceB] = await Promise.all([
        storeServiceA.getAppInstance(identityHash),
        storeServiceB.getAppInstance(identityHash),
      ]);
      const [newChannelA, newChannelB] = await Promise.all([
        storeServiceA.getStateChannel(multisigAddress),
        storeServiceB.getStateChannel(multisigAddress),
      ]);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newAppInstanceA!).toMatchObject(newAppInstanceB!);
      expect(newAppInstanceA!.identityHash).toBe(identityHash);
      expect(newAppInstanceA!.appSeqNo).toBe(3);
      expect(newAppInstanceA!.latestVersionNumber).toBe(1);
      expect(newChannelA!.freeBalanceAppInstance!.latestVersionNumber).toBe(4);
      expect(newChannelA!.monotonicNumProposedApps).toBe(3);
      expect(newChannelA!.appInstances.length).toBe(1);
    }, 30_000);

    test("sync protocol -- responder has an app uninstalled by initiator", async () => {
      await messagingServiceA.disconnect();
      const [eventData, newNodeA] = await Promise.all([
        new Promise(async (resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerA,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "A"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeA.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);

      // create new app
      [identityHash] = await installApp(nodeB, newNodeA as CFCore, multisigAddress, TicTacToeApp);
      const [newAppInstanceA, newAppInstanceB] = await Promise.all([
        storeServiceA.getAppInstance(identityHash),
        storeServiceB.getAppInstance(identityHash),
      ]);
      const [newChannelA, newChannelB] = await Promise.all([
        storeServiceA.getStateChannel(multisigAddress),
        storeServiceB.getStateChannel(multisigAddress),
      ]);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newAppInstanceA!).toMatchObject(newAppInstanceB!);
      expect(newAppInstanceB!.identityHash).toBe(identityHash);
      expect(newAppInstanceB!.appSeqNo).toBe(3);
      expect(newAppInstanceB!.latestVersionNumber).toBe(1);
      expect(newChannelB!.freeBalanceAppInstance!.latestVersionNumber).toBe(4);
      expect(newChannelB!.monotonicNumProposedApps).toBe(3);
      expect(newChannelB!.appInstances.length).toBe(1);
    }, 30_000);
  });

  describe("Sync::takeAction", () => {
    let appIdentityHash;
    beforeEach(async () => {
      // uninstall-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(
        sharedEventEmitter,
        0,
        ProtocolNames.takeAction,
      );
      nodeA = await CFCore.create(
        messagingServiceA,
        storeServiceA,
        global["contracts"],
        nodeConfig,
        provider,
        channelSignerA,
        lockService,
        0,
        new Logger("CreateClient", env.logLevel, true, "A"),
      );

      // create channel
      multisigAddress = await createChannel(nodeA, nodeB);

      // create app
      [appIdentityHash] = await installApp(nodeA, nodeB, multisigAddress, TicTacToeApp);

      await new Promise(async (resolve, reject) => {
        nodeA.once(EventNames.UPDATE_STATE_EVENT, () => resolve());
        try {
          await nodeB.rpcRouter.dispatch(
            constructTakeActionRpc(appIdentityHash, multisigAddress, validAction),
          );
          reject(`Should not be able to complete protocol`);
        } catch (e) {
          log.info(`Caught error sending rpc: ${e.message}`);
        }
      });

      // get expected channel from nodeB
      expectedChannel = (await storeServiceA.getStateChannel(multisigAddress))!;
      expect(expectedChannel.appInstances.length).toBe(1);
      let ret = expectedChannel.appInstances.find(([id, app]) => id === appIdentityHash);
      expect(ret).toBeDefined();
      const expectedAppInstance = ret![1];
      expect(expectedAppInstance.latestVersionNumber).toBe(2);

      const unsynced = (await storeServiceB.getStateChannel(multisigAddress))!;
      expect(unsynced.appInstances.length).toBe(1);
      ret = unsynced.appInstances.find(([id, app]) => id === appIdentityHash);
      expect(ret).toBeDefined();
      const unsyncedAppInstance = ret![1];
      expect(unsyncedAppInstance.latestVersionNumber).toBe(1);
      messagingServiceA.clearLimits();
    }, 30_000);

    test("initiator has an app that has a single signed update that the responder does not have", async () => {
      const [eventData, newNodeA] = await Promise.all([
        new Promise(async (resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerA,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "A"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeA.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);

      //attempt to uninstall
      await uninstallApp(newNodeA as CFCore, nodeB, appIdentityHash, multisigAddress);
      const newChannelA = await storeServiceA.getStateChannel(multisigAddress);
      const newChannelB = await storeServiceB.getStateChannel(multisigAddress);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newChannelA!.appInstances.length).toBe(0);
      expect(newChannelA!.freeBalanceAppInstance!.latestVersionNumber).toBe(3);
      expect(newChannelA!.monotonicNumProposedApps).toBe(2);
    }, 30_000);

    test("responder has an app that has a single signed update that the initiator does not have", async () => {
      const [eventData, newNodeB] = await Promise.all([
        new Promise(async (resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        CFCore.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["contracts"],
          nodeConfig,
          provider,
          channelSignerB,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "B"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeB.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel!);

      //attempt to uninstall
      await uninstallApp(nodeA, newNodeB as CFCore, appIdentityHash, multisigAddress);
      const newChannelA = await storeServiceA.getStateChannel(multisigAddress);
      const newChannelB = await storeServiceB.getStateChannel(multisigAddress);
      expect(newChannelA!).toMatchObject(newChannelB!);
      expect(newChannelB!.appInstances.length).toBe(0);
      expect(newChannelB!.freeBalanceAppInstance!.latestVersionNumber).toBe(3);
      expect(newChannelB!.monotonicNumProposedApps).toBe(2);
    }, 30_000);
  });
});
