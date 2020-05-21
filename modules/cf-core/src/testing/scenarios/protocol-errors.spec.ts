import { env } from "../setup";
import { Node } from "../../node";
import { createChannel, makeProposeCall, assertMessage } from "../utils";
import { MemoryMessagingServiceWithLimits } from "../services/memory-messaging-service-limits";
import { deBigNumberifyJson, ChannelSigner } from "@connext/utils";
import { A_PRIVATE_KEY, B_PRIVATE_KEY } from "../test-constants.jest";
import { TestContractAddresses } from "../contracts";
import {
  MethodParams,
  JsonRpcProvider,
  IClientStore,
  EventNames,
  CF_METHOD_TIMEOUT,
} from "@connext/types";
import { getMemoryStore } from "@connext/store";
import { MemoryLockService } from "../services";
import { Logger } from "../logger";
import { EventEmitter } from "events";

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

describe("Protocol Errors", () => {
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
  let messagingServiceA: MemoryMessagingServiceWithLimits;
  let messagingServiceB: MemoryMessagingServiceWithLimits;

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
      "NodeB",
    );
    storeServiceB = getMemoryStore();
    channelSignerB = new ChannelSigner(B_PRIVATE_KEY, ethUrl);
    await storeServiceB.init();
    nodeB = await Node.create(
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
  });

  it("should emit a protocol error if protocol initiator timeout occurs", async () => {
    messagingServiceA = new MemoryMessagingServiceWithLimits(sharedEventEmitter, 1, "propose");
    nodeA = await Node.create(
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
    const multisigAddress = await createChannel(nodeA, nodeB);

    const initiatorFailure = `IO_SEND_AND_WAIT timed out after ${
      CF_METHOD_TIMEOUT / 1000
    }s waiting for counterparty reply in propose`;

    // load stores with proposal
    const rpc = makeProposeCall(nodeB, TicTacToeApp, multisigAddress);
    const params = {
      ...(rpc.parameters as MethodParams.ProposeInstall),
      multisigAddress,
      meta: {
        info: "Provided meta",
      },
    };

    await Promise.all([
      new Promise(async (resolve) => {
        await expect(
          nodeA.rpcRouter.dispatch({
            ...rpc,
            parameters: deBigNumberifyJson(params),
          }),
        ).rejects.toThrowError(initiatorFailure);
        resolve();
      }),
      new Promise((resolve) => {
        nodeB.once(EventNames.PROPOSE_INSTALL_FAILED_EVENT, async (msg) => {
          console.log("nodeB msg: ", msg);
          assertMessage(
            msg,
            {
              from: nodeA.publicIdentifier,
              data: {
                params: {
                  responderIdentifier: nodeB.publicIdentifier,
                  initiatorIdentifier: nodeA.publicIdentifier,
                },
              },
              type: EventNames.PROPOSE_INSTALL_FAILED_EVENT,
            },
            ["data.params.multisigAddress", "data.error"],
          );
          expect(msg.data.error).toContain("BLAH");
          resolve();
        });
      }),
      new Promise((resolve) => {
        nodeA.once(EventNames.PROPOSE_INSTALL_FAILED_EVENT, async (msg) => {
          console.log("nodeA msg: ", msg);
          assertMessage(
            msg,
            {
              from: nodeA.publicIdentifier,
              data: {
                params: {
                  responderIdentifier: nodeB.publicIdentifier,
                  initiatorIdentifier: nodeA.publicIdentifier,
                },
              },
            },
            ["data.params.multisigAddress", "data.error"],
          );
          expect(msg.data.error).toContain(initiatorFailure);
          resolve();
        });
      }),
    ]);
  }, 30_000);
});
