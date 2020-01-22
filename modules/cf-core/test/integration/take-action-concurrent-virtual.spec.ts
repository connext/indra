import { parseEther } from "ethers/utils";

import { Node } from "../../src";
import {
  InstallVirtualMessage,
  NODE_EVENTS,
  UpdateStateMessage
} from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";
import { toBeLt } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import { validAction } from "./tic-tac-toe";
import {
  collateralizeChannel,
  constructTakeActionRpc,
  createChannel,
  installVirtualApp
} from "./utils";
import { UPDATE_STATE_EVENT, INSTALL_VIRTUAL_EVENT } from "@connext/types";

expect.extend({ toBeLt });

jest.setTimeout(15000);

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

describe("Concurrently taking action on virtual apps without issue", () => {
  let multisigAddressAB: string;
  let multisigAddressBC: string;
  let nodeA: Node;
  let nodeB: Node;
  let nodeC: Node;

  beforeEach(async () => {
    const context: SetupContext = await setup(global, true);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    nodeC = context["C"].node;

    multisigAddressAB = await createChannel(nodeA, nodeB);
    multisigAddressBC = await createChannel(nodeB, nodeC);

    await collateralizeChannel(
      multisigAddressAB,
      nodeA,
      nodeB,
      parseEther("2")
    );

    await collateralizeChannel(
      multisigAddressBC,
      nodeB,
      nodeC,
      parseEther("2")
    );
  });

  it("can handle two concurrent TTT virtual app take actions", async done => {
    const INSTALLED_APPS = 2;
    const appIds: string[] = [];

    nodeA.on(INSTALL_VIRTUAL_EVENT, (msg: InstallVirtualMessage) => {
      expect(msg.data.params.appInstanceId).toBeTruthy();
      appIds.push(msg.data.params.appInstanceId);
    });

    for (const i of Array(INSTALLED_APPS)) {
      await installVirtualApp(nodeA, nodeB, nodeC, TicTacToeApp);
    }

    while (appIds.length !== INSTALLED_APPS) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    let appsTakenActionOn = 0;

    nodeC.on(UPDATE_STATE_EVENT, () => {
      appsTakenActionOn += 1;
      if (appsTakenActionOn === 2) done();
    });

    const takeActionReq = (appId: string) =>
      constructTakeActionRpc(appId, validAction);

    nodeA.rpcRouter.dispatch(takeActionReq(appIds[0]));
    nodeA.rpcRouter.dispatch(takeActionReq(appIds[1]));
  });
});
