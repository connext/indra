import { MethodNames } from "@connext/types";

import { CFCore } from "../../cfCore";

import { setup, SetupContext } from "../setup";
import { expect } from "../assertions";
import { getChainId } from "../utils";

describe(`Node method follows spec - getStateDepositHolderAddress`, () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  before(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context[`A`].node;
    nodeB = context[`B`].node;
  });

  it(`can accept a valid call and return correctly formatted address`, async () => {
    const owners = [nodeA.publicIdentifier, nodeB.publicIdentifier];

    const {
      result: {
        result: { address },
      },
    } = await nodeA.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_getStateDepositHolderAddress,
      parameters: { owners, chainId: getChainId() },
    });

    expect(address.length).to.eq(42);
  });
});
