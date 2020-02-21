import { CFCoreTypes, REJECT_INSTALL_EVENT, PROPOSE_INSTALL_EVENT } from "@connext/types";

import { Node } from "../../src";
import { ProposeMessage } from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";

import { SetupContext, setupWithMemoryMessagingAndSlowStore } from "./setup";
import {
  confirmProposedAppInstance,
  constructRejectInstallRpc,
  createChannel,
  getProposedAppInstances,
  makeVirtualProposeCall,
} from "./utils";

const { TicTacToeApp } = global[`networkContext`] as NetworkContextForTestSuite;

// Postgres testing is pretty pointless here, since it's using a different interface
describe.skip(`Node method follows spec - rejectInstallVirtual`, () => {
  let nodeA: Node;
  let nodeB: Node;
  let nodeC: Node;

  beforeAll(async () => {
    const context: SetupContext = await setupWithMemoryMessagingAndSlowStore(global, true);
    nodeA = context[`A`].node;
    nodeB = context[`B`].node;
    nodeC = context[`C`].node;
  });

  describe(
    `Node A makes a proposal through an intermediary Node B to install a ` +
      `Virtual AppInstance with Node C. Node C rejects proposal. Node A confirms rejection`,
    () => {
      it.skip(`sends proposal with non-null initial state`, async done => {
        const multisigAB = await createChannel(nodeA, nodeB);
        const multisigBC = await createChannel(nodeB, nodeC);

        let proposalParams: CFCoreTypes.ProposeInstallVirtualParams;

        nodeA.on(REJECT_INSTALL_EVENT, async () => {
          expect((await getProposedAppInstances(nodeA, multisigAB)).length).toEqual(0);
          done();
        });

        nodeC.on(PROPOSE_INSTALL_EVENT, async (msg: ProposeMessage) => {
          const { appInstanceId } = msg.data;

          const [proposedAppInstanceA] = await getProposedAppInstances(nodeA, multisigAB);
          const [proposedAppInstanceC] = await getProposedAppInstances(nodeC, multisigBC);

          confirmProposedAppInstance(proposalParams, proposedAppInstanceA);

          confirmProposedAppInstance(proposalParams, proposedAppInstanceC);

          expect(proposedAppInstanceC.proposedByIdentifier).toEqual(nodeA.publicIdentifier);
          expect(proposedAppInstanceA.identityHash).toEqual(proposedAppInstanceC.identityHash);

          const rejectReq = constructRejectInstallRpc(appInstanceId);

          await nodeC.rpcRouter.dispatch(rejectReq);

          expect((await getProposedAppInstances(nodeC, multisigBC)).length).toEqual(0);
        });

        const result = await makeVirtualProposeCall(nodeA, nodeC, TicTacToeApp);

        proposalParams = result.params;
      });
    },
  );
});
