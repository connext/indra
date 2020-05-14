import { env } from "../setup";
import { Node } from "../../node";
import {
  createChannel,
  makeProposeCall,
  constructInstallRpc,
  makeAndSendProposeCall,
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
  let expectedChannel: StateChannelJSON;

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
    const messagingServiceB = new MemoryMessagingServiceWithLimits(sharedEventEmitter);
    storeServiceB = getMemoryStore();
    const channelSignerB = new ChannelSigner(B_PRIVATE_KEY, ethUrl);
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
      const messagingServiceA = new MemoryMessagingServiceWithLimits(
        sharedEventEmitter,
        1,
        "propose",
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
          console.log(`Caught error sending rpc: ${stringify(e)}`);
        }
      });

      // recreate nodeA
      nodeA = await Node.create(
        new MemoryMessagingServiceWithLimits(sharedEventEmitter),
        storeServiceA,
        global["network"],
        nodeConfig,
        provider,
        channelSignerA,
        lockService,
        0,
        new Logger("CreateClient", env.logLevel, true, "A"),
      );

      // get expected channel from nodeB
      expectedChannel = (await storeServiceB.getStateChannel(multisigAddress))!;
      expect(expectedChannel.proposedAppInstances.length).toBe(1);
    });

    test("sync protocol initiator is missing a proposal held by the protocol responder", async () => {
      const [eventData, rpcResult] = (await Promise.all([
        new Promise((resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        nodeA.rpcRouter.dispatch({
          methodName: MethodNames.chan_sync,
          parameters: { multisigAddress } as MethodParams.Sync,
          id: Date.now(),
        }),
      ])) as [EventPayloads.Sync, any];

      const {
        result: {
          result: { syncedChannel },
        },
      } = rpcResult;
      expect(eventData).toMatchObject({
        from: nodeA.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);

    test("sync protocol responder is missing a proposal held by the protocol initiator", async () => {
      const [eventData, rpcResult] = (await Promise.all([
        new Promise((resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        nodeB.rpcRouter.dispatch({
          methodName: MethodNames.chan_sync,
          parameters: { multisigAddress } as MethodParams.Sync,
          id: Date.now(),
        }),
      ])) as [EventPayloads.Sync, any];

      const {
        result: {
          result: { syncedChannel },
        },
      } = rpcResult;
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
      const messagingServiceA = new MemoryMessagingServiceWithLimits(
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
      console.log(`expected channel`, stringify(expectedChannel));
      await delay(500);

      // recreate nodeA
      nodeA = await Node.create(
        new MemoryMessagingServiceWithLimits(sharedEventEmitter),
        storeServiceA,
        global["network"],
        nodeConfig,
        provider,
        channelSignerA,
        lockService,
        0,
        new Logger("CreateClient", env.logLevel, true, "A"),
      );
    }, 30_000);

    test("sync protocol -- initiator is missing an app held by responder", async () => {
      // above stuff should be in before, now begin real test
      const [eventData, rpcResult] = (await Promise.all([
        new Promise((resolve) => {
          nodeB.on(EventNames.SYNC, (data) => resolve(data));
        }),
        nodeA.rpcRouter.dispatch({
          methodName: MethodNames.chan_sync,
          parameters: { multisigAddress } as MethodParams.Sync,
          id: Date.now(),
        }),
      ])) as [EventPayloads.Sync, any];

      const {
        result: {
          result: { syncedChannel },
        },
      } = rpcResult;
      expect(eventData).toMatchObject({
        from: nodeA.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);

    test("sync protocol -- initiator is missing an app held by initiator", async () => {
      // above stuff should be in before, now begin real test
      const [eventData, rpcResult] = (await Promise.all([
        new Promise((resolve) => {
          nodeA.on(EventNames.SYNC, (data) => resolve(data));
        }),
        nodeB.rpcRouter.dispatch({
          methodName: MethodNames.chan_sync,
          parameters: { multisigAddress } as MethodParams.Sync,
          id: Date.now(),
        }),
      ])) as [EventPayloads.Sync, any];

      const {
        result: {
          result: { syncedChannel },
        },
      } = rpcResult;
      expect(eventData).toMatchObject({
        from: nodeB.publicIdentifier,
        type: EventNames.SYNC,
        data: { syncedChannel: expectedChannel },
      });
      expect(syncedChannel).toMatchObject(expectedChannel);
    }, 30_000);
  });

  describe("Sync::takeAction", () => {
    beforeEach(async () => {});
  });

  describe("Sync::uninstall", () => {
    beforeEach(async () => {});
  });
});
