import { Node } from "../../src";
import {
  NODE_EVENTS,
  ProposeMessage,
  RejectProposalMessage
} from "../../src/types";
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
  makeAndSendProposeCall
} from "./utils";

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

      expect(await getInstalledAppInstances(nodeA)).toEqual([]);
      expect(await getInstalledAppInstances(nodeB)).toEqual([]);

      let proposedAppId: string;
      nodeA.on("REJECT_INSTALL_EVENT", async (msg: RejectProposalMessage) => {
        assertNodeMessage(msg, {
          from: nodeB.publicIdentifier,
          type: "REJECT_INSTALL_EVENT",
          data: {
            appInstanceId: proposedAppId
          }
        });
        expect((await getProposedAppInstances(nodeA)).length).toEqual(0);
        expect((await getProposedAppInstances(nodeB)).length).toEqual(0);
        done();
      });

      // node B then decides to reject the proposal
      nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
        const rejectReq = constructRejectInstallRpc(msg.data.appInstanceId);
        expect((await getProposedAppInstances(nodeA)).length).toEqual(1);
        expect((await getProposedAppInstances(nodeB)).length).toEqual(1);
        proposedAppId = msg.data.appInstanceId;
        await nodeB.rpcRouter.dispatch(rejectReq);
      });

      const { params, appInstanceId } = await makeAndSendProposeCall(
        nodeA,
        nodeB,
        TicTacToeApp
      );

      await confirmProposedAppInstance(
        params,
        await getAppInstanceProposal(nodeA, appInstanceId)
      );
    });
    it("Node A installs, node a rejects", async done => {
      const multisigAddress = await createChannel(nodeA, nodeB);

      await collateralizeChannel(multisigAddress, nodeA, nodeB);

      expect(await getInstalledAppInstances(nodeA)).toEqual([]);
      expect(await getInstalledAppInstances(nodeB)).toEqual([]);

      let proposedAppId: string;
      nodeB.on("REJECT_INSTALL_EVENT", async (msg: RejectProposalMessage) => {
        assertNodeMessage(msg, {
          from: nodeA.publicIdentifier,
          type: "REJECT_INSTALL_EVENT",
          data: {
            appInstanceId: proposedAppId
          }
        });
        expect((await getProposedAppInstances(nodeA)).length).toEqual(0);
        expect((await getProposedAppInstances(nodeB)).length).toEqual(0);
        done();
      });

      // node A then decides to reject the proposal
      nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
        const rejectReq = constructRejectInstallRpc(msg.data.appInstanceId);
        expect((await getProposedAppInstances(nodeA)).length).toEqual(1);
        expect((await getProposedAppInstances(nodeB)).length).toEqual(1);
        proposedAppId = msg.data.appInstanceId;
        await nodeA.rpcRouter.dispatch(rejectReq);
      });

      const { params, appInstanceId } = await makeAndSendProposeCall(
        nodeA,
        nodeB,
        TicTacToeApp
      );

      await confirmProposedAppInstance(
        params,
        await getAppInstanceProposal(nodeA, appInstanceId)
      );
    });
  });
});
