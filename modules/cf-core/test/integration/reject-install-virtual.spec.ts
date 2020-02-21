import { Node } from "../../src";
import { ProposeMessage, RejectInstallVirtualMessage } from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";

import { setup, SetupContext } from "./setup";
import {
  confirmProposedAppInstance,
  constructRejectInstallRpc,
  createChannel,
  getProposedAppInstances,
  makeVirtualProposeCall,
  assertNodeMessage,
} from "./utils";
import { REJECT_INSTALL_EVENT } from "@connext/types";

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

describe.skip("Node method follows spec - rejectInstallVirtual", () => {
  let nodeA: Node;
  let nodeB: Node;
  let nodeC: Node;

  beforeAll(async () => {
    const context: SetupContext = await setup(global, true);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    nodeC = context["C"].node;
  });

  describe(
    "Node A makes a proposal through an intermediary Node B to install a " +
      "Virtual AppInstance with Node C. Node C rejects proposal. Node A confirms rejection",
    () => {
      it("sends proposal with non-null initial state", async done => {
        const multisigAB = await createChannel(nodeA, nodeB);
        const multisigBC = await createChannel(nodeB, nodeC);

        let appInstanceId: string;

        nodeA.on(REJECT_INSTALL_EVENT, async (msg: RejectInstallVirtualMessage) => {
          expect((await getProposedAppInstances(nodeA, multisigAB)).length).toEqual(0);
          assertNodeMessage(msg, {
            from: nodeC.publicIdentifier,
            data: {
              appInstanceId,
            },
            type: REJECT_INSTALL_EVENT,
          });
          done();
        });

        nodeC.once(
          "PROPOSE_INSTALL_EVENT",
          async ({ data: { params, appInstanceId } }: ProposeMessage) => {
            const [proposedAppInstanceC] = await getProposedAppInstances(nodeC, multisigBC);
            appInstanceId = proposedAppInstanceC.identityHash;

            confirmProposedAppInstance(params, proposedAppInstanceC);

            expect(proposedAppInstanceC.proposedByIdentifier).toEqual(nodeA.publicIdentifier);

            const rejectReq = constructRejectInstallRpc(appInstanceId);
            await nodeC.rpcRouter.dispatch(rejectReq);
            expect((await getProposedAppInstances(nodeC, multisigBC)).length).toEqual(0);
          },
        );

        const { params } = await makeVirtualProposeCall(nodeA, nodeC, TicTacToeApp);

        const [proposedAppInstanceA] = await getProposedAppInstances(nodeA, multisigAB);

        confirmProposedAppInstance(params, proposedAppInstanceA);
      });
    },
  );
});
