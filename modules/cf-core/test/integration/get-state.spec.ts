import { v4 as generateUUID } from "uuid";

import { Node } from "../../src";
import { NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID } from "../../src/errors";

import { NetworkContextForTestSuite } from "../contracts";

import { setup, SetupContext } from "./setup";
import { initialEmptyTTTState } from "./tic-tac-toe";
import { constructGetStateRpc, createChannel, getState, installApp } from "./utils";

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

describe("Node method follows spec - getAppInstances", () => {
  let nodeA: Node;
  let nodeB: Node;

  beforeAll(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  it("returns the right response for getting the state of a non-existent AppInstance", async () => {
    const appId = generateUUID();
    const getStateReq = constructGetStateRpc(appId);
    await expect(nodeA.rpcRouter.dispatch(getStateReq)).rejects.toThrowError(
      NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appId),
    );
  });

  it("returns the right state for an installed AppInstance", async () => {
    const multisigAddress = await createChannel(nodeA, nodeB);

    const [appInstanceId, params] = await installApp(nodeA, nodeB, multisigAddress, TicTacToeApp);

    const state = await getState(nodeA, appInstanceId);

    const initialState = initialEmptyTTTState();
    for (const property in initialState) {
      expect(state[property]).toEqual(params.initialState[property]);
    }
  });
});
