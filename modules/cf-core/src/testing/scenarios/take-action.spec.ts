import { EventNames, UpdateStateMessage, EventPayload } from "@connext/types";
import { constants } from "ethers";

import { CFCore } from "../../cfCore";
import { NO_MULTISIG_IN_PARAMS, NO_APP_INSTANCE_FOR_GIVEN_HASH } from "../../errors";

import { setup, SetupContext } from "../setup";
import { validAction } from "../tic-tac-toe";
import {
  assertMessage,
  constructTakeActionRpc,
  createChannel,
  getAppInstance,
  getContractAddresses,
  installApp,
} from "../utils";
import { toBN, deBigNumberifyJson } from "@connext/utils";
import { expect } from "../assertions";

const { Zero, Two } = constants;

// NOTE: no initiator events
function confirmMessages(
  initiator: CFCore,
  responder: CFCore,
  expectedData: EventPayload[typeof EventNames.UPDATE_STATE_EVENT],
) {
  const expected = {
    from: initiator.publicIdentifier,
    type: EventNames.UPDATE_STATE_EVENT,
    data: expectedData,
  };
  // initiator.once(EventNames.UPDATE_STATE_EVENT, (msg: UpdateStateMessage) => {
  //   assertMessage(msg, expected);
  // });
  responder.once(EventNames.UPDATE_STATE_EVENT, (msg) => {
    assertMessage<typeof EventNames.UPDATE_STATE_EVENT>(msg, expected);
  });
}

describe("Node method follows spec - takeAction", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;
  let TicTacToeApp: string;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    TicTacToeApp = getContractAddresses().TicTacToeApp;
  });

  describe(
    "Node A and B install an AppInstance, Node A takes action, " +
      "Node B confirms receipt of state update",
    () => {
      it("sends takeAction with invalid appIdentityHash", async () => {
        const multisigAddress = await createChannel(nodeA, nodeB);
        const takeActionReq = constructTakeActionRpc("0xfail", multisigAddress, validAction);

        await expect(nodeA.rpcRouter.dispatch(takeActionReq)).to.eventually.be.rejected;
      });

      it("sends takeAction with invalid multisig address", async () => {
        const takeActionReq = constructTakeActionRpc("", "", validAction);

        await expect(nodeA.rpcRouter.dispatch(takeActionReq)).to.eventually.be.rejectedWith(
          NO_MULTISIG_IN_PARAMS(takeActionReq.parameters),
        );
      });

      it("can take action", async () => {
        return new Promise(async (done) => {
          const multisigAddress = await createChannel(nodeA, nodeB);
          const [appIdentityHash] = await installApp(nodeA, nodeB, multisigAddress, TicTacToeApp);

          const expectedNewState = {
            board: [
              [Two, Zero, Zero],
              [Zero, Zero, Zero],
              [Zero, Zero, Zero],
            ],
            versionNumber: toBN(2),
            winner: Zero,
          };

          nodeB.on(EventNames.UPDATE_STATE_EVENT, async (msg: UpdateStateMessage) => {
            /**
             * TEST #3
             * The database of Node C is correctly updated and querying it works
             */
            const { latestState: state } = await getAppInstance(nodeB, appIdentityHash);

            expect(state).to.deep.eq(deBigNumberifyJson(expectedNewState));

            done();
          });

          const takeActionReq = constructTakeActionRpc(
            appIdentityHash,
            multisigAddress,
            validAction,
          );

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
          } = await nodeB.rpcRouter.dispatch(takeActionReq);
          // allow nodeA to confirm its messages
          await new Promise((resolve) => {
            nodeA.once(EventNames.UPDATE_STATE_EVENT, () => {
              setTimeout(resolve, 500);
            });
          });

          expect(newState).to.deep.eq(expectedNewState);
        });
      });
    },
  );
});
