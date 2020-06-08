import { MethodParams } from "@connext/types";
import { deBigNumberifyJson } from "@connext/utils";

import { CFCore } from "../../cfCore";

import { toBeLt } from "../bignumber-jest-matcher";
import { TestContractAddresses } from "../contracts";
import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  createChannel,
  getAppInstanceJson,
  getProposedAppInstances,
  makeProposeCall,
} from "../utils";

expect.extend({ toBeLt });

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

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
    const appA = await getAppInstanceJson(nodeA, id, multisigAddress);
    const appB = await getAppInstanceJson(nodeB, id, multisigAddress);
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
    });

    it("propose install an app with eth and a meta", async (done: jest.DoneCallback) => {
      const rpc = makeProposeCall(nodeB, TicTacToeApp, multisigAddress);
      const params = {
        ...(rpc.parameters as MethodParams.ProposeInstall),
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

      const appId = await new Promise(async (resolve, reject) => {
        let identityHash: string = "";
        let dispatched = false;
        nodeB.once("PROPOSE_INSTALL_EVENT", async (msg) => {
          // make sure message has the right structure
          assertMessage<"PROPOSE_INSTALL_EVENT">(msg, expectedMessageB, ["data.appInstanceId"]);
          // both nodes should have 1 app, they should be the same
          identityHash = msg.data.appInstanceId;
          if (dispatched) resolve(identityHash);
        });

        // TODO: add expected message B
        try {
          await nodeA.rpcRouter.dispatch({
            ...rpc,
            parameters: deBigNumberifyJson(params),
          });
          dispatched = true;
          if (identityHash) resolve(identityHash);
        } catch (e) {
          return reject(e);
        }
      });
      await assertEqualProposedApps(nodeA, nodeB, multisigAddress, [appId] as string[]);
      done();
    });
  });
});
