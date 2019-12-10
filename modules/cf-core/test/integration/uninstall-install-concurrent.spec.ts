import { One } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { Node } from "../../src";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../src/constants";
import { InstallMessage, NODE_EVENTS, ProposeMessage } from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";
import { toBeLt } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import {
  collateralizeChannel,
  constructUninstallRpc,
  createChannel,
  makeInstallCall,
  makeProposeCall
} from "./utils";

expect.extend({ toBeLt });

jest.setTimeout(7500);

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

describe("Node method follows spec when happening concurrently - install / uninstall", () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;
  let installedAppInstanceId: string;
  let installCall;

  describe("NodeA can uninstall and install an app with nodeB concurrently", () => {
    beforeEach(async () => {
      const context: SetupContext = await setup(global);
      nodeA = context["A"].node;
      nodeB = context["B"].node;

      multisigAddress = await createChannel(nodeA, nodeB);

      await collateralizeChannel(
        multisigAddress,
        nodeA,
        nodeB,
        parseEther("2") // We are depositing in 2 and use 1 for each concurrent app
      );

      installCall = makeProposeCall(
        nodeB,
        TicTacToeApp,
        /* initialState */ undefined,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS
      );

      // install the first app
      installedAppInstanceId = await new Promise(async resolve => {
        nodeB.once("PROPOSE_INSTALL_EVENT", (msg: ProposeMessage) => {
          makeInstallCall(nodeB, msg.data.appInstanceId);
        });

        nodeA.once("INSTALL_EVENT", (msg: InstallMessage) => {
          // save the first installed appId
          resolve(msg.data.params.appInstanceId);
        });

        await nodeA.rpcRouter.dispatch(installCall);
      });
    });

    it("install app with ETH then uninstall and install apps simultaneously from the same node", async done => {
      let completedActions = 0;

      nodeB.once("PROPOSE_INSTALL_EVENT", (msg: ProposeMessage) =>
        makeInstallCall(nodeB, msg.data.appInstanceId)
      );

      nodeA.once("INSTALL_EVENT", () => {
        completedActions += 1;
        if (completedActions === 2) done();
      });

      // if this is on nodeA, test fails
      nodeB.once("UNINSTALL_EVENT", () => {
        completedActions += 1;
        if (completedActions === 2) done();
      });

      const installCall = makeProposeCall(
        nodeB,
        TicTacToeApp,
        /* initialState */ undefined,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS
      );

      nodeA.rpcRouter.dispatch(installCall);
      nodeA.rpcRouter.dispatch(constructUninstallRpc(installedAppInstanceId));
    });

    it("install app with ETH then uninstall and install apps simultaneously from separate nodes", async done => {
      let completedActions = 0;

      nodeB.once("PROPOSE_INSTALL_EVENT", (msg: ProposeMessage) =>
        makeInstallCall(nodeB, msg.data.appInstanceId)
      );

      nodeA.once("INSTALL_EVENT", () => {
        completedActions += 1;
        if (completedActions === 2) done();
      });

      // if this is on nodeB, test fails
      nodeA.once("UNINSTALL_EVENT", () => {
        completedActions += 1;
        if (completedActions === 2) done();
      });

      const installCall = makeProposeCall(
        nodeB,
        TicTacToeApp,
        /* initialState */ undefined,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS
      );

      nodeA.rpcRouter.dispatch(installCall);
      nodeB.rpcRouter.dispatch(constructUninstallRpc(installedAppInstanceId));
    });
  });
});
