import { MethodNames } from "@connext/types";

import { CFCore } from "../../cfCore";

import { setup, SetupContext } from "../setup";

describe(`Node method follows spec - getStateDepositHolderAddress`, () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  beforeAll(async () => {
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
      parameters: { owners },
    });

    expect(address.length).toBe(42);
  });
});
