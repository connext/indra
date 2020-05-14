import { env } from "../setup";
import { Node } from "../../node";
import {
  createChannel,
  makeProposeCall,
  constructInstallRpc,
  makeAndSendProposeCall,
  installApp,
  constructUninstallRpc,
  constructTakeActionRpc,
} from "../utils";
import { MemoryMessagingServiceWithLimits } from "../services/memory-messaging-service-limits";
import { deBigNumberifyJson, ChannelSigner, stringify, delay } from "@connext/utils";
import { A_PRIVATE_KEY, B_PRIVATE_KEY } from "../test-constants.jest";
import { NetworkContextForTestSuite } from "../contracts";
import {
  MethodParams,
  JsonRpcProvider,
  IClientStore,
  MethodNames,
  EventNames,
  EventPayloads,
  StateChannelJSON,
  ProtocolNames,
} from "@connext/types";
import { getMemoryStore } from "@connext/store";
import { MemoryLockService } from "../services";
import { Logger } from "../logger";
import { EventEmitter } from "events";
import { validAction } from "../tic-tac-toe";

const { TicTacToeApp } = global["network"] as NetworkContextForTestSuite;

describe("Sync", () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;
  let storeServiceA: IClientStore;
  let storeServiceB: IClientStore;
  let sharedEventEmitter: EventEmitter;
  let ethUrl: string;
  let provider: JsonRpcProvider;
  let nodeConfig: any;
  let lockService: MemoryLockService;
  let channelSignerA: ChannelSigner;
  let channelSignerB: ChannelSigner;
  let expectedChannel: StateChannelJSON;
  let messagingServiceA: MemoryMessagingServiceWithLimits;
  let messagingServiceB: MemoryMessagingServiceWithLimits;

  const log = new Logger("Sync", env.logLevel, true);

  beforeEach(async () => {
    // test global fixtures
    sharedEventEmitter = new EventEmitter();
    ethUrl = global["network"]["provider"].connection.url;
    provider = new JsonRpcProvider(ethUrl);
    nodeConfig = { STORE_KEY_PREFIX: "test" };
    lockService = new MemoryLockService();

    // create nodeA values
    storeServiceA = getMemoryStore();
    channelSignerA = new ChannelSigner(A_PRIVATE_KEY, ethUrl);
    await storeServiceA.init();

    // create nodeB values
    messagingServiceB = new MemoryMessagingServiceWithLimits(
      sharedEventEmitter,
      undefined,
      undefined,
      "NodeB",
    );
    storeServiceB = getMemoryStore();
    channelSignerB = new ChannelSigner(B_PRIVATE_KEY, ethUrl);
    await storeServiceB.init();
    nodeB = await Node.create(
      messagingServiceB,
      storeServiceB,
      global["network"],
      nodeConfig,
      provider,
      channelSignerB,
      lockService,
      0,
      new Logger("CreateClient", env.logLevel, true, "A"),
    );
  });

  describe("Sync::propose", () => {
    beforeEach(async () => {
      // propose-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(sharedEventEmitter, 1, "propose");
      nodeA = await Node.create(
        messagingServiceA,
        storeServiceA,
        global["network"],
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
      const rpc = makeProposeCall(nodeB, TicTacToeApp, multisigAddress);
      const params = {
        ...(rpc.parameters as MethodParams.ProposeInstall),
        multisigAddress: undefined,
        meta: {
          info: "Provided meta",
        },
      };
      await new Promise(async (res) => {
        nodeB.once("PROPOSE_INSTALL_EVENT", res);
        try {
          await nodeA.rpcRouter.dispatch({
            ...rpc,
            parameters: deBigNumberifyJson(params),
          });
        } catch (e) {
          log.info(`Caught error sending rpc: ${stringify(e)}`);
        }
      });

      // get expected channel from nodeB
      expectedChannel = (await storeServiceB.getStateChannel(multisigAddress))!;
      expect(expectedChannel.proposedAppInstances.length).toBe(1);
      const unsynced = await storeServiceA.getStateChannel(multisigAddress);
      expect(unsynced?.proposedAppInstances.length).toBe(0);
    });

    test("sync protocol initiator is missing a proposal held by the protocol responder", async () => {
      const [eventData] = await Promise.all([
        new Promise(async (resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        Node.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["network"],
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
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);

    test("sync protocol responder is missing a proposal held by the protocol initiator", async () => {
      messagingServiceB.disconnect();
      messagingServiceA.connect();
      const [eventData] = await Promise.all([
        new Promise(async (resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        Node.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["network"],
          nodeConfig,
          provider,
          channelSignerB,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "A"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeB.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);
  });

  describe("Sync::install", () => {
    // TODO: figure out how to fast-forward IO_SEND_AND_WAIT
    beforeEach(async () => {
      // install-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(
        sharedEventEmitter,
        1,
        ProtocolNames.install,
      );
      nodeA = await Node.create(
        messagingServiceA,
        storeServiceA,
        global["network"],
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
          nodeB.once(EventNames.PROPOSE_INSTALL_EVENT, resolve);
        }),
      ]);
      const { appIdentityHash } = ret as any;

      // nodeB should initiate the installation
      await new Promise(async (resolve, reject) => {
        nodeB.once(EventNames.INSTALL_EVENT, () => reject("NodeB caught install event"));
        nodeA.once(EventNames.INSTALL_EVENT, () => reject("NodeA caught install event"));
        try {
          await nodeB.rpcRouter.dispatch(constructInstallRpc(appIdentityHash));
          return reject(`Initiator should not be able to complete the installation`);
        } catch (e) {
          return resolve();
        }
      });

      // get expected channel from nodeB
      expectedChannel = (await storeServiceB.getStateChannel(multisigAddress))!;
      expect(expectedChannel.appInstances.length).toBe(1);
      const unsynced = await storeServiceA.getStateChannel(multisigAddress);
      expect(unsynced?.appInstances.length).toBe(0);
    }, 30_000);

    test("sync protocol -- initiator is missing an app held by responder", async () => {
      const [eventData] = await Promise.all([
        new Promise(async (resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        Node.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["network"],
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
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);

    test("sync protocol -- responder is missing an app held by initiator", async () => {
      messagingServiceB.disconnect();
      messagingServiceA.connect();

      const [eventData] = await Promise.all([
        new Promise(async (resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        Node.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["network"],
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
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);
  });

  describe("Sync::uninstall", () => {
    beforeEach(async () => {
      // uninstall-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(
        sharedEventEmitter,
        1,
        ProtocolNames.uninstall,
      );
      nodeA = await Node.create(
        messagingServiceA,
        storeServiceA,
        global["network"],
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
      const [identityHash] = await installApp(nodeA, nodeB, multisigAddress, TicTacToeApp);

      // nodeB should respond to the uninstall, nodeA will not get the
      // message, but nodeB thinks its sent
      await new Promise(async (resolve, reject) => {
        nodeA.once(EventNames.UNINSTALL_EVENT, () => reject("NodeA caught uninstall event"));
        nodeB.once(EventNames.UNINSTALL_EVENT, () => resolve);
        try {
          await nodeA.rpcRouter.dispatch(constructUninstallRpc(identityHash));
          return reject(`Initiator should be able to complete uninstall`);
        } catch (e) {
          return resolve();
        }
      });

      // get expected channel from nodeB
      expectedChannel = (await storeServiceB.getStateChannel(multisigAddress))!;
      expect(expectedChannel.appInstances.length).toBe(0);
      const unsynced = await storeServiceA.getStateChannel(multisigAddress);
      expect(unsynced?.appInstances.length).toBe(1);
    }, 30_000);

    test("sync protocol -- initiator has an app uninstalled by responder", async () => {
      const [eventData] = await Promise.all([
        new Promise(async (resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        Node.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["network"],
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
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);

    test("sync protocol -- responder has an app uninstalled by initiator", async () => {
      messagingServiceB.disconnect();
      messagingServiceA.connect();
      const [eventData] = await Promise.all([
        new Promise(async (resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        Node.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["network"],
          nodeConfig,
          provider,
          channelSignerB,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "A"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeB.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);
  });

  describe("Sync::takeAction", () => {
    beforeEach(async () => {
      // uninstall-specific setup
      messagingServiceA = new MemoryMessagingServiceWithLimits(
        sharedEventEmitter,
        1,
        ProtocolNames.takeAction,
        "NodeA",
      );
      nodeA = await Node.create(
        messagingServiceA,
        storeServiceA,
        global["network"],
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
      const [identityHash] = await installApp(nodeA, nodeB, multisigAddress, TicTacToeApp);

      await new Promise(async (resolve, reject) => {
        nodeB.once(EventNames.UPDATE_STATE_EVENT, () => resolve());
        try {
          await nodeA.rpcRouter.dispatch(constructTakeActionRpc(identityHash, validAction));
        } catch (e) {
          console.log(`Caught error sending rpc: ${stringify(e)}`);
        }
      });

      // get expected channel from nodeB
      expectedChannel = (await storeServiceB.getStateChannel(multisigAddress))!;
      expect(expectedChannel.appInstances.length).toBe(1);
      let ret = expectedChannel.appInstances.find(([id, app]) => id === identityHash);
      expect(ret).toBeDefined();
      const expectedAppInstance = ret![1];
      expect(expectedAppInstance.latestVersionNumber).toBe(2);

      const unsynced = (await storeServiceA.getStateChannel(multisigAddress))!;
      expect(unsynced.appInstances.length).toBe(1);
      ret = unsynced.appInstances.find(([id, app]) => id === identityHash);
      expect(ret).toBeDefined();
      const unsyncedAppInstance = ret![1];
      expect(unsyncedAppInstance.latestVersionNumber).toBe(1);
    }, 30_000);

    test("responder has an app that has a single signed update that the initiator does not have", async () => {
      const [eventData] = await Promise.all([
        new Promise(async (resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        Node.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceA,
          global["network"],
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
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);

    test("initiator has an app that has a single signed update that the responder does not have", async () => {
      messagingServiceB.disconnect();
      messagingServiceA.connect();
      const [eventData] = await Promise.all([
        new Promise(async (resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        Node.create(
          new MemoryMessagingServiceWithLimits(sharedEventEmitter),
          storeServiceB,
          global["network"],
          nodeConfig,
          provider,
          channelSignerB,
          lockService,
          0,
          new Logger("CreateClient", env.logLevel, true, "A"),
        ),
      ]);

      const syncedChannel = await storeServiceA.getStateChannel(multisigAddress);
      expect(eventData).toMatchObject({
        from: nodeB.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);
  });
});
