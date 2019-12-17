import { CFCoreTypes } from "@connext/types";
import { One, Zero } from "ethers/constants";

import {
  NO_APP_INSTANCE_FOR_TAKE_ACTION,
  Node,
  NODE_EVENTS,
  UpdateStateMessage
} from "../../src";
import { NetworkContextForTestSuite } from "../contracts";

import { setup, SetupContext } from "./setup";
import { validAction } from "./tic-tac-toe";
import {
  constructGetStateRpc,
  constructTakeActionRpc,
  createChannel,
  installApp,
  assertNodeMessage
} from "./utils";

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

// NOTE: no initiator events
function confirmMessages(initiator: Node, responder: Node, expectedData: CFCoreTypes.UpdateStateEventData) {
  const expected = {
    from: initiator.publicIdentifier,
    type: "UPDATE_STATE_EVENT",
    data: expectedData,
  };
  // initiator.once("UPDATE_STATE_EVENT", (msg: UpdateStateMessage) => {
  //   assertNodeMessage(msg, expected);
  // });
  responder.once("UPDATE_STATE_EVENT", (msg: UpdateStateMessage) => {
    assertNodeMessage(msg, expected);
  });
}

describe("Node method follows spec - takeAction", () => {
  let nodeA: Node;
  let nodeB: Node;

  beforeAll(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe(
    "Node A and B install an AppInstance, Node A takes action, " +
      "Node B confirms receipt of state update",
    () => {
      it("sends takeAction with invalid appInstanceId", async () => {
        const takeActionReq = constructTakeActionRpc("", validAction);

        await expect(
          nodeA.rpcRouter.dispatch(takeActionReq)
        ).rejects.toThrowError(NO_APP_INSTANCE_FOR_TAKE_ACTION);
      });

      it("can take action", async done => {
        await createChannel(nodeA, nodeB);
        const [appInstanceId] = await installApp(nodeA, nodeB, TicTacToeApp);

        const expectedNewState = {
          board: [[One, Zero, Zero], [Zero, Zero, Zero], [Zero, Zero, Zero]],
          versionNumber: One,
          winner: Zero
        };

        nodeB.on("UPDATE_STATE_EVENT", async (msg: UpdateStateMessage) => {
          /**
           * TEST #3
           * The database of Node C is correctly updated and querying it works
           */
          const {
            result: {
              result: { state }
            }
          } = await nodeB.rpcRouter.dispatch(
            constructGetStateRpc(appInstanceId)
          );

          expect(state).toEqual(expectedNewState);

          done();
        });

        const takeActionReq = constructTakeActionRpc(
          appInstanceId,
          validAction
        );

        /**
         * TEST #1
         * The event emittted by Node C after an action is taken by A
         * sends the appInstanceId and the newState correctly.
         */
        confirmMessages(nodeA, nodeB, { 
          newState: expectedNewState,
          appInstanceId,
          action: validAction,
        });

        /**
         * TEST #2
         * The return value from the call to Node A includes the new state
         */
        const {
          result: {
            result: { newState }
          }
        } = await nodeA.rpcRouter.dispatch(takeActionReq);
        // allow nodeA to confirm its messages
        await new Promise(resolve => {
          nodeA.once("UPDATE_STATE_EVENT", () => {
            setTimeout(resolve, 2000)
          });
        });

        expect(newState).toEqual(expectedNewState);
      });
    }
  );
});
