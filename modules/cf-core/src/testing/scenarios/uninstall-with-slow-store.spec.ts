import { UninstallMessage } from "@connext/types";
import { delay } from "@connext/utils";

import { Node } from "../../node";

import { NetworkContextForTestSuite } from "../contracts";
import { SetupContext, setup } from "../setup";
import {
  constructUninstallRpc,
  createChannel,
  getInstalledAppInstances,
  installApp,
} from "../utils";

const { TicTacToeApp } = global["network"] as NetworkContextForTestSuite;

describe("Node method follows spec - uninstall", () => {
  let nodeA: Node;
  let nodeB: Node;

  beforeAll(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe("Node A and B install TTT, then uninstall it", () => {
    it("sends proposal with non-null initial state", async done => {
      const initialState = {
        versionNumber: 1,
        winner: 1, // Hard-coded winner for test
        board: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
      };

      const multisigAddess = await createChannel(nodeA, nodeB);
      expect(multisigAddess).toBeDefined;

      const [appIdentityHash] = await installApp(
        nodeA,
        nodeB,
        multisigAddess,
        TicTacToeApp,
        initialState,
      );
      expect(appIdentityHash).toBeDefined;

      nodeB.once("UNINSTALL_EVENT", async (msg: UninstallMessage) => {
        expect(msg.data.appIdentityHash).toBe(appIdentityHash);

        // FIXME: There is some timing issue with slow stores @snario noticed
        await delay(1000);

        expect(await getInstalledAppInstances(nodeB, multisigAddess)).toEqual([]);
        done();
      });

      await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash));

      expect(await getInstalledAppInstances(nodeA, multisigAddess)).toEqual([]);
    });
  });
});
