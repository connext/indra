import { EventNames, EventPayloads, UpdateStateMessage } from "@connext/types";
import { One, Zero } from "ethers/constants";

import { Node } from "../../node";
import { NO_APP_INSTANCE_FOR_TAKE_ACTION } from "../../errors";

import { NetworkContextForTestSuite } from "../contracts";
import { setup, SetupContext } from "../setup";
import { validAction } from "../tic-tac-toe";
import {
  constructGetStateRpc,
  constructTakeActionRpc,
  createChannel,
  installApp,
  assertNodeMessage,
} from "../utils";

const { TicTacToeApp } = global["network"] as NetworkContextForTestSuite;

// NOTE: no initiator events
function confirmMessages(
  initiator: Node,
  responder: Node,
  expectedData: EventPayloads.UpdateState,
) {
  const expected = {
    from: initiator.publicIdentifier,
    type: EventNames.UPDATE_STATE_EVENT,
    data: expectedData,
  };
  // initiator.once(EventNames.UPDATE_STATE_EVENT, (msg: UpdateStateMessage) => {
  //   assertNodeMessage(msg, expected);
  // });
  responder.once(EventNames.UPDATE_STATE_EVENT, (msg: UpdateStateMessage) => {
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
      it("sends takeAction with invalid appIdentityHash", async () => {
        const takeActionReq = constructTakeActionRpc("", validAction);

        await expect(nodeA.rpcRouter.dispatch(takeActionReq)).rejects.toThrowError(
          NO_APP_INSTANCE_FOR_TAKE_ACTION,
        );
      });

      it("can take action", async done => {
        const multisigAddress = await createChannel(nodeA, nodeB);
        const [appIdentityHash] = await installApp(nodeA, nodeB, multisigAddress, TicTacToeApp);

        const expectedNewState = {
          board: [
            [One, Zero, Zero],
            [Zero, Zero, Zero],
            [Zero, Zero, Zero],
          ],
          versionNumber: One,
          winner: Zero,
        };

        nodeB.on(EventNames.UPDATE_STATE_EVENT, async (msg: UpdateStateMessage) => {
          /**
           * TEST #3
           * The database of Node C is correctly updated and querying it works
           */
          const {
            result: {
              result: { state },
            },
          } = await nodeB.rpcRouter.dispatch(constructGetStateRpc(appIdentityHash));

          expect(state).toEqual(expectedNewState);

          done();
        });

        const takeActionReq = constructTakeActionRpc(appIdentityHash, validAction);

        /**
         * TEST #1
         * The event emittted by Node C after an action is taken by A
         * sends the appIdentityHash and the newState correctly.
         */
        confirmMessages(nodeA, nodeB, {
          newState: expectedNewState,
          appIdentityHash,
          action: validAction,
        });

        /**
         * TEST #2
         * The return value from the call to Node A includes the new state
         */
        const {
          result: {
            result: { newState },
          },
        } = await nodeA.rpcRouter.dispatch(takeActionReq);
        // allow nodeA to confirm its messages
        await new Promise(resolve => {
          nodeA.once(EventNames.UPDATE_STATE_EVENT, () => {
            setTimeout(resolve, 2000);
          });
        });

        expect(newState).toEqual(expectedNewState);
      });
    },
  );
});
