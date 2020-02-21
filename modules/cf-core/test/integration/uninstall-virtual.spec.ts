import { Node } from "../../src";
import { UninstallVirtualMessage } from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";

import { setup, SetupContext } from "./setup";
import {
  collateralizeChannel,
  constructUninstallVirtualRpc,
  createChannel,
  getInstalledAppInstances,
  installVirtualApp,
  assertNodeMessage,
} from "./utils";

jest.setTimeout(10000);

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

describe("Node method follows spec - uninstall virtual", () => {
  let nodeA: Node;
  let nodeB: Node;
  let nodeC: Node;

  beforeAll(async () => {
    const context: SetupContext = await setup(global, true);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    nodeC = context["C"].node;
  });

  describe(
    "Node A and C install a Virtual AppInstance through an intermediary Node B," +
      "then Node A uninstalls the installed AppInstance",
    () => {
      it("sends uninstall ", async done => {
        const initialState = {
          versionNumber: 0,
          winner: 1, // Hard-coded winner for test
          board: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
        };

        const multisigAddressAB = await createChannel(nodeA, nodeB);
        const multisigAddressBC = await createChannel(nodeB, nodeC);

        await collateralizeChannel(multisigAddressAB, nodeA, nodeB);
        await collateralizeChannel(multisigAddressBC, nodeB, nodeC);

        const appInstanceId = await installVirtualApp(
          nodeA,
          nodeB,
          nodeC,
          TicTacToeApp,
          initialState,
        );

        nodeC.once("UNINSTALL_VIRTUAL_EVENT", async (msg: UninstallVirtualMessage) => {
          assertNodeMessage(msg, {
            from: nodeA.publicIdentifier,
            type: "UNINSTALL_VIRTUAL_EVENT",
            data: {
              intermediaryIdentifier: nodeB.publicIdentifier,
              appInstanceId,
            },
          });

          expect(await getInstalledAppInstances(nodeC, multisigAddressBC)).toEqual([]);

          done();
        });

        await nodeA.rpcRouter.dispatch(
          constructUninstallVirtualRpc(appInstanceId, nodeB.publicIdentifier),
        );

        expect(await getInstalledAppInstances(nodeA, multisigAddressAB)).toEqual([]);
      });
    },
  );
});
