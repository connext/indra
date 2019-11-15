import { Node } from "../../src";

import { toBeLt } from "../machine/integration/bignumber-jest-matcher";

import { SetupContext, setup } from "./setup";
import { createChannel, collateralizeChannel } from "./utils";

expect.extend({ toBeLt });

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

    it("propose install an app with eth", async done => {
    })
  })
})
