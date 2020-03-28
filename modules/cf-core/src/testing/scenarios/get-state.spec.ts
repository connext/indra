import { v4 as uuid } from "uuid";

import { Node } from "../../node";
import { NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID } from "../../errors";

import { NetworkContextForTestSuite } from "../contracts";
import { constructGetStateRpc, createChannel, getState, installApp } from "../utils";
import { setup, SetupContext } from "../setup";
import { initialEmptyTTTState } from "../tic-tac-toe";

const { TicTacToeApp } = global["network"] as NetworkContextForTestSuite;

describe("Node method follows spec - getAppInstances", () => {
  let nodeA: Node;
  let nodeB: Node;

  beforeAll(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  it("returns the right response for getting the state of a non-existent AppInstance", async () => {
    const appId = uuid();
    const getStateReq = constructGetStateRpc(appId);
    await expect(nodeA.rpcRouter.dispatch(getStateReq)).rejects.toThrowError(
      `No AppInstance exists for the given ID`,
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
