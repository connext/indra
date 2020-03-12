import { Node } from "../../src";
import { ProposeMessage, RejectProposalMessage } from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";

import { setup, SetupContext } from "./setup";
import {
  assertNodeMessage,
  collateralizeChannel,
  confirmProposedAppInstance,
  constructRejectInstallRpc,
  createChannel,
  getAppInstanceProposal,
  getInstalledAppInstances,
  getProposedAppInstances,
  makeAndSendProposeCall,
} from "./utils";
import { REJECT_INSTALL_EVENT } from "@connext/types";

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

describe("Node method follows spec - rejectInstall", () => {
  let nodeA: Node;
  let nodeB: Node;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe("Rejects proposal with non-null initial state", () => {
    it("Node A installs, node b rejects", async done => {
      const multisigAddress = await createChannel(nodeA, nodeB);

      await collateralizeChannel(multisigAddress, nodeA, nodeB);

      expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
      expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);

      let proposedAppId: string;
      nodeA.on(REJECT_INSTALL_EVENT, async (msg: RejectProposalMessage) => {
        assertNodeMessage(msg, {
          from: nodeB.publicIdentifier,
          type: REJECT_INSTALL_EVENT,
          data: {
            appInstanceId: proposedAppId,
          },
        });
        expect((await getProposedAppInstances(nodeA, multisigAddress)).length).toEqual(0);
        expect((await getProposedAppInstances(nodeB, multisigAddress)).length).toEqual(0);
        done();
      });

      // node B then decides to reject the proposal
      nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
        const rejectReq = constructRejectInstallRpc(msg.data.appInstanceId);
        expect((await getProposedAppInstances(nodeA, multisigAddress)).length).toEqual(1);
        expect((await getProposedAppInstances(nodeB, multisigAddress)).length).toEqual(1);
        proposedAppId = msg.data.appInstanceId;
        await nodeB.rpcRouter.dispatch(rejectReq);
      });

      const { params, appInstanceId } = await makeAndSendProposeCall(nodeA, nodeB, TicTacToeApp);

      confirmProposedAppInstance(
        params,
        await getAppInstanceProposal(nodeA, appInstanceId, multisigAddress),
      );
    });
    it("Node A installs, node a rejects", async done => {
      const multisigAddress = await createChannel(nodeA, nodeB);

      await collateralizeChannel(multisigAddress, nodeA, nodeB);

      expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
      expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);

      let proposedAppId: string;
      nodeB.on(REJECT_INSTALL_EVENT, async (msg: RejectProposalMessage) => {
        assertNodeMessage(msg, {
          from: nodeA.publicIdentifier,
          type: REJECT_INSTALL_EVENT,
          data: {
            appInstanceId: proposedAppId,
          },
        });
        expect((await getProposedAppInstances(nodeA, multisigAddress)).length).toEqual(0);
        expect((await getProposedAppInstances(nodeB, multisigAddress)).length).toEqual(0);
        done();
      });

      // node A then decides to reject the proposal
      nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
        const rejectReq = constructRejectInstallRpc(msg.data.appInstanceId);
        expect((await getProposedAppInstances(nodeA, multisigAddress)).length).toEqual(1);
        expect((await getProposedAppInstances(nodeB, multisigAddress)).length).toEqual(1);
        proposedAppId = msg.data.appInstanceId;
        await nodeA.rpcRouter.dispatch(rejectReq);
      });

      const { params, appInstanceId } = await makeAndSendProposeCall(nodeA, nodeB, TicTacToeApp);

      confirmProposedAppInstance(
        params,
        await getAppInstanceProposal(nodeA, appInstanceId, multisigAddress),
      );
    });
  });
});
