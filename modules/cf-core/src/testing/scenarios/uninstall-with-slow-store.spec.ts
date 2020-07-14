import { UninstallMessage } from "@connext/types";
import { delay } from "@connext/utils";

import { CFCore } from "../../cfCore";

import { SetupContext, setup } from "../setup";
import {
  constructUninstallRpc,
  createChannel,
  getContractAddresses,
  getInstalledAppInstances,
  installApp,
} from "../utils";
import { expect } from "../assertions";

describe("Node method follows spec - uninstall", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  before(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe("Node A and B install TTT, then uninstall it", () => {
    it("sends proposal with non-null initial state", async () => {
      return new Promise(async (done) => {
        const { TicTacToeApp } = getContractAddresses();
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
        expect(multisigAddess).to.be.ok;

        const [appIdentityHash] = await installApp(
          nodeA,
          nodeB,
          multisigAddess,
          TicTacToeApp,
          initialState,
        );
        expect(appIdentityHash).to.deep.eq;

        nodeB.once("UNINSTALL_EVENT", async (msg: UninstallMessage) => {
          expect(msg.data.appIdentityHash).to.eq(appIdentityHash);
          expect(msg.data.multisigAddress).to.eq(multisigAddess);

          // FIXME: There is some timing issue with slow stores @snario noticed
          await delay(1000);

          expect(await getInstalledAppInstances(nodeB, multisigAddess)).to.deep.eq([]);
          done();
        });

        await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash, multisigAddess));

        expect(await getInstalledAppInstances(nodeA, multisigAddess)).to.deep.eq([]);
      });
    });
  });
});
