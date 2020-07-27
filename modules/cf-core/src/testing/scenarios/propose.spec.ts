import {
  MethodParams,
  MethodNames,
  MethodResults,
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";
import { deBigNumberifyJson } from "@connext/utils";
import { constants } from "ethers";

import { CFCore } from "../../cfCore";

import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  getContractAddresses,
  createChannel,
  getAppInstanceJson,
  getProposedAppInstances,
  makeProposeCall,
  makeAndSendProposeCall,
} from "../utils";
import { expect } from "../assertions";
import { MAX_CHANNEL_APPS } from "../../constants";
import { TOO_MANY_APPS_IN_CHANNEL } from "../../errors";

async function assertEqualProposedApps(
  nodeA: CFCore,
  nodeB: CFCore,
  multisigAddress: string,
  expectedAppIds: string[],
): Promise<void> {
  const proposedA = await getProposedAppInstances(nodeA, multisigAddress);
  const proposedB = await getProposedAppInstances(nodeB, multisigAddress);
  expect(proposedB.length).to.be.eq(proposedA.length);
  expect(proposedB.length).to.be.eq(expectedAppIds.length);
  expect(proposedA).to.deep.eq(proposedB);
  // check each appID
  for (const id of expectedAppIds) {
    const appA = await getAppInstanceJson(nodeA, id, multisigAddress);
    const appB = await getAppInstanceJson(nodeB, id, multisigAddress);
    expect(appA).to.deep.eq(appB);
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

    it("propose install an app with eth and a meta", async () => {
      const { TicTacToeApp } = getContractAddresses();

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
    });

    it("cannot propose more than the max number of apps", async () => {
      const { TicTacToeApp } = getContractAddresses();

      for (let i = 0; i < MAX_CHANNEL_APPS; i++) {
        await makeAndSendProposeCall(
          nodeA,
          nodeB,
          TicTacToeApp,
          multisigAddress,
          undefined,
          constants.Zero,
          CONVENTION_FOR_ETH_ASSET_ID,
          constants.Zero,
          CONVENTION_FOR_ETH_ASSET_ID,
        );
      }

      const {
        result: {
          result: { appInstances },
        },
      } = (await nodeA.rpcRouter.dispatch({
        id: Date.now(),
        methodName: MethodNames.chan_getProposedAppInstances,
        parameters: { multisigAddress } as MethodParams.GetProposedAppInstances,
      })) as { result: { result: MethodResults.GetProposedAppInstances } };
      expect(appInstances.length).to.be.eq(MAX_CHANNEL_APPS);

      await expect(
        makeAndSendProposeCall(
          nodeA,
          nodeB,
          TicTacToeApp,
          multisigAddress,
          undefined,
          constants.Zero,
          CONVENTION_FOR_ETH_ASSET_ID,
          constants.Zero,
          CONVENTION_FOR_ETH_ASSET_ID,
        ),
      ).to.be.rejectedWith(TOO_MANY_APPS_IN_CHANNEL);
    });
  });
});
