import { Node as NodeTypes } from "@connext/types";
import { NetworkContextForTestSuite } from "@counterfactual/local-ganache-server";

import { Node, NODE_EVENTS, ProposeMessage } from "../../src";
import { toBeLt } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import {
  assertNodeMessage,
  collateralizeChannel,
  createChannel,
  getAppInstanceProposal,
  getProposedAppInstances,
  makeProposeCall,
} from "./utils";

expect.extend({ toBeLt });

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

async function assertEqualProposedApps(
  nodeA: Node,
  nodeB: Node,
  expectedAppIds: string[],
): Promise<void> {
  const proposedA = await getProposedAppInstances(nodeA);
  const proposedB = await getProposedAppInstances(nodeB);
  expect(proposedB.length).toEqual(proposedA.length);
  expect(proposedB.length).toEqual(expectedAppIds.length);
  expect(proposedA).toEqual(proposedB);
  // check each appID
  for (const id of expectedAppIds) {
    const appA = await getAppInstanceProposal(nodeA, id);
    const appB = await getAppInstanceProposal(nodeB, id);
    expect(appA).toEqual(appB);
  }
}

describe("Node method follows spec - propose install", () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;

  describe("NodeA initiates proposal, nodeB approves, found in both stores", () => {
    beforeEach(async () => {
      const context: SetupContext = await setup(global);
      nodeA = context["A"].node;
      nodeB = context["B"].node;

      multisigAddress = await createChannel(nodeA, nodeB);
      await collateralizeChannel(multisigAddress, nodeA, nodeB);
    });

    it("propose install an app with eth and a meta", async (done: jest.DoneCallback) => {
      const rpc = makeProposeCall(nodeB, TicTacToeApp);
      const params = {
        ...(rpc.parameters as NodeTypes.ProposeInstallParams),
        meta: {
          info: "Provided meta",
        },
      };
      const expectedMessageB = {
        data: {
          params,
        },
        from: nodeA.publicIdentifier,
        type: NODE_EVENTS.PROPOSE_INSTALL,
      };

      nodeB.once(NODE_EVENTS.PROPOSE_INSTALL, async (msg: ProposeMessage) => {
        // make sure message has the right structure
        assertNodeMessage(msg, expectedMessageB, ["data.appInstanceId"]);
        // both nodes should have 1 app, they should be the same
        await assertEqualProposedApps(nodeA, nodeB, [msg.data.appInstanceId]);
        done();
      });

      // TODO: add expected message B

      await nodeA.rpcRouter.dispatch({
        ...rpc,
        parameters: params,
      });
    });
  });
});
