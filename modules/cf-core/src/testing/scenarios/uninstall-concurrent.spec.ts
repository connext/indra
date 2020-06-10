import {
  CONVENTION_FOR_ETH_ASSET_ID,
  InstallMessage,
  ProposeMessage,
  UninstallMessage,
} from "@connext/types";
import { constants, utils } from "ethers";

import { CFCore } from "../../cfCore";

import { TestContractAddresses } from "../contracts";
import { toBeLt } from "../bignumber-jest-matcher";

import { setup, SetupContext } from "../setup";
import {
  collateralizeChannel,
  constructUninstallRpc,
  createChannel,
  makeInstallCall,
  makeProposeCall,
} from "../utils";

const { One } = constants;
const { parseEther } = utils;

expect.extend({ toBeLt });

jest.setTimeout(7500);

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

describe("Node method follows spec - uninstall", () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;

  describe("Should be able to successfully uninstall apps concurrently", () => {
    beforeEach(async () => {
      const context: SetupContext = await setup(global);
      nodeA = context["A"].node;
      nodeB = context["B"].node;

      multisigAddress = await createChannel(nodeA, nodeB);
    });

    it("uninstall apps with ETH concurrently", async (done) => {
      const appIdentityHashes: string[] = [];
      let uninstalledApps = 0;
      await collateralizeChannel(
        multisigAddress,
        nodeA,
        nodeB,
        parseEther("2"), // We are depositing in 2 and use 1 for each concurrent app
      );

      nodeB.on("PROPOSE_INSTALL_EVENT", (msg: ProposeMessage) => {
        makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress);
      });

      nodeA.on("INSTALL_EVENT", (msg: InstallMessage) => {
        appIdentityHashes.push(msg.data.appIdentityHash);
      });

      const proposeRpc = makeProposeCall(
        nodeB,
        TicTacToeApp,
        multisigAddress,
        /* initialState */ undefined,
        One,
        CONVENTION_FOR_ETH_ASSET_ID,
        One,
        CONVENTION_FOR_ETH_ASSET_ID,
      );

      nodeA.rpcRouter.dispatch(proposeRpc);
      nodeA.rpcRouter.dispatch(proposeRpc);

      while (appIdentityHashes.length !== 2) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHashes[0], multisigAddress));
      nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHashes[1], multisigAddress));

      // NOTE: nodeA does not ever emit this event
      nodeB.on("UNINSTALL_EVENT", (msg: UninstallMessage) => {
        expect(appIdentityHashes.includes(msg.data.appIdentityHash)).toBe(true);
        expect(msg.data.multisigAddress).toBe(multisigAddress);
        uninstalledApps += 1;
        if (uninstalledApps === 2) done();
      });
    });
  });
});
