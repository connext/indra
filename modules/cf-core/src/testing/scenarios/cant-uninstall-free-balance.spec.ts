import { CFCore } from "../../cfCore";
import { CANNOT_UNINSTALL_FREE_BALANCE } from "../../errors";

import { setup, SetupContext } from "../setup";
import { constructUninstallRpc, createChannel, constructGetStateChannelRpc } from "../utils";
import { expect } from "../assertions";

describe("Confirms that a FreeBalance cannot be uninstalled", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  before(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe("Node A and B open channel, attempt to uninstall FreeBalance", () => {
    it("can't uninstall FreeBalance", async () => {
      const multisigAddress = await createChannel(nodeA, nodeB);

      const {
        result: {
          result: { data: channel },
        },
      } = await nodeA.rpcRouter.dispatch(constructGetStateChannelRpc(multisigAddress));
      expect(channel.multisigAddress).to.eq(multisigAddress);

      const fbUninstallReq = constructUninstallRpc(
        channel.freeBalanceAppInstance.identityHash,
        channel.multisigAddress,
      );

      try {
        await nodeA.rpcRouter.dispatch(fbUninstallReq);
      } catch (e) {
        expect(e.toString()).to.includes(CANNOT_UNINSTALL_FREE_BALANCE(multisigAddress));
      }
    });
  });
});
