import { CONVENTION_FOR_ETH_ASSET_ID, InstallMessage, ProposeMessage } from "@connext/types";
import { constants, utils } from "ethers";

import { CFCore } from "../../cfCore";

import { setup, SetupContext } from "../setup";
import {
  collateralizeChannel,
  constructUninstallRpc,
  createChannel,
  getContractAddresses,
  makeInstallCall,
  makeProposeCall,
} from "../utils";

const { One } = constants;
const { parseEther } = utils;

describe("Node method follows spec when happening concurrently - install / uninstall", () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;
  let installedAppIdentityHash: string;
  let installCall;

  describe("NodeA can uninstall and install an app with nodeB concurrently", () => {
    beforeEach(async () => {
      const { TicTacToeApp } = getContractAddresses();
      const context: SetupContext = await setup(global);
      nodeA = context["A"].node;
      nodeB = context["B"].node;

      multisigAddress = await createChannel(nodeA, nodeB);

      await collateralizeChannel(
        multisigAddress,
        nodeA,
        nodeB,
        parseEther("2"), // We are depositing in 2 and use 1 for each concurrent app
      );

      installCall = makeProposeCall(
        nodeB,
        TicTacToeApp,
        multisigAddress,
        /* initialState */ undefined,
        One,
        CONVENTION_FOR_ETH_ASSET_ID,
        One,
        CONVENTION_FOR_ETH_ASSET_ID,
      );

      // install the first app
      installedAppIdentityHash = await new Promise(async (resolve) => {
        nodeB.once("PROPOSE_INSTALL_EVENT", (msg: ProposeMessage) => {
          makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress);
        });

        nodeA.once("INSTALL_EVENT", (msg: InstallMessage) => {
          // save the first installed appId
          resolve(msg.data.appIdentityHash);
        });

        await nodeA.rpcRouter.dispatch(installCall);
      });
    });

    it("install app with ETH then uninstall and install apps simultaneously from the same node", async () => {
      return new Promise(async (done) => {
        const { TicTacToeApp } = getContractAddresses();
        let completedActions = 0;

        nodeB.once("PROPOSE_INSTALL_EVENT", (msg: ProposeMessage) =>
          makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress),
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
          multisigAddress,
          /* initialState */ undefined,
          One,
          CONVENTION_FOR_ETH_ASSET_ID,
          One,
          CONVENTION_FOR_ETH_ASSET_ID,
        );

        nodeA.rpcRouter.dispatch(installCall);
        nodeA.rpcRouter.dispatch(constructUninstallRpc(installedAppIdentityHash, multisigAddress));
      });
    });

    it("install app with ETH then uninstall and install apps simultaneously from separate nodes", async () => {
      return new Promise(async (done) => {
        const { TicTacToeApp } = getContractAddresses();
        let completedActions = 0;

        nodeB.once("PROPOSE_INSTALL_EVENT", (msg: ProposeMessage) =>
          makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress),
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
          multisigAddress,
          /* initialState */ undefined,
          One,
          CONVENTION_FOR_ETH_ASSET_ID,
          One,
          CONVENTION_FOR_ETH_ASSET_ID,
        );

        nodeA.rpcRouter.dispatch(installCall);
        nodeB.rpcRouter.dispatch(constructUninstallRpc(installedAppIdentityHash, multisigAddress));
      });
    });
  });
});
