import { CFCore } from "../../cfCore";

import { constructTakeActionRpc, createChannel, getContractAddresses, installApp } from "../utils";
import { setup, SetupContext } from "../setup";
import { expect } from "../../testing/assertions";

describe("Node method follows spec - fails with improper action taken", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  before(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe("Node A and B install an AppInstance, Node A takes invalid action", () => {
    it("can't take invalid action", async () => {
      const { TicTacToeApp } = getContractAddresses();
      const validAction = {
        actionType: 1,
        playX: 0,
        playY: 0,
        winClaim: {
          winClaimType: 0,
          idx: 0,
        },
      };
      const multisigAddress = await createChannel(nodeA, nodeB);

      const [appIdentityHash] = await installApp(nodeA, nodeB, multisigAddress, TicTacToeApp);

      const takeActionReq = constructTakeActionRpc(appIdentityHash, multisigAddress, validAction);

      await expect(nodeA.rpcRouter.dispatch(takeActionReq)).to.eventually.be.rejectedWith(
        "Cannot compute state transition",
      );
    });
  });
});
