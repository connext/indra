import { ProposeMessage, MethodParams } from "@connext/types";
import { deBigNumberifyJson } from "@connext/utils";

import { CFCore } from "../../cfCore";

import { toBeLt } from "../bignumber-jest-matcher";
import { NetworkContextForTestSuite } from "../contracts";
import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  collateralizeChannel,
  createChannel,
  getAppInstanceProposal,
  getProposedAppInstances,
  makeProposeCall,
} from "../utils";

expect.extend({ toBeLt });

const { TicTacToeApp } = global["network"] as NetworkContextForTestSuite;

async function assertEqualProposedApps(
  nodeA: CFCore,
  nodeB: CFCore,
  multisigAddress: string,
  expectedAppIds: string[],
): Promise<void> {
  const proposedA = await getProposedAppInstances(nodeA, multisigAddress);
  const proposedB = await getProposedAppInstances(nodeB, multisigAddress);
  expect(proposedB.length).toEqual(proposedA.length);
  expect(proposedB.length).toEqual(expectedAppIds.length);
  expect(proposedA).toEqual(proposedB);
  // check each appID
  for (const id of expectedAppIds) {
    const appA = await getAppInstanceProposal(nodeA, id, multisigAddress);
    const appB = await getAppInstanceProposal(nodeB, id, multisigAddress);
    expect(appA).toEqual(appB);
  }
}

describe("Node method follows spec - propose install", () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;

  describe("NodeA initiates proposal, nodeB approves, found in both stores", () => {
    beforeEach(async () => {
      const context: SetupContext = await setup(global);
      nodeA = context["A"].node;
      nodeB = context["B"].node;

      multisigAddress = await createChannel(nodeA, nodeB);
      await collateralizeChannel(multisigAddress, nodeA, nodeB);
    });

    it("propose install an app with eth and a meta", async (done: jest.DoneCallback) => {
      const rpc = makeProposeCall(nodeB, TicTacToeApp, multisigAddress);
      const params = {
        ...(rpc.parameters as MethodParams.ProposeInstall),
        multisigAddress: undefined,
        meta: {
          info: "Provided meta",
        },
      };
      const expectedMessageB = {
        data: {
          params,
        },
        from: nodeA.publicIdentifier,
        type: "PROPOSE_INSTALL_EVENT",
      };

      nodeB.once("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
        // make sure message has the right structure
        assertMessage(msg, expectedMessageB, ["data.appIdentityHash"]);
        // both nodes should have 1 app, they should be the same
        await assertEqualProposedApps(nodeA, nodeB, multisigAddress, [msg.data.appIdentityHash]);
        done();
      });

      // TODO: add expected message B

      await nodeA.rpcRouter.dispatch({
        ...rpc,
        parameters: deBigNumberifyJson(params),
      });
    });
  });
});
