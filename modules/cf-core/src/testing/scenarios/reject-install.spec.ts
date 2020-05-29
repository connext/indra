import { EventNames, ProposeMessage, RejectProposalMessage } from "@connext/types";

import { CFCore } from "../../cfCore";

import { TestContractAddresses } from "../contracts";
import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  collateralizeChannel,
  constructRejectInstallRpc,
  createChannel,
  getInstalledAppInstances,
  getProposedAppInstances,
  makeAndSendProposeCall,
} from "../utils";

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

describe("Node method follows spec - rejectInstall", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe("Rejects proposal with non-null initial state", () => {
    it("Node A installs, node b rejects", async (done) => {
      const multisigAddress = await createChannel(nodeA, nodeB);

      await collateralizeChannel(multisigAddress, nodeA, nodeB);

      expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
      expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);

      let proposedAppId: string;
      nodeA.on(EventNames.REJECT_INSTALL_EVENT, async (msg: RejectProposalMessage) => {
        assertMessage(msg, {
          from: nodeB.publicIdentifier,
          type: EventNames.REJECT_INSTALL_EVENT,
          data: {
            appIdentityHash: proposedAppId,
          },
        });
        expect((await getProposedAppInstances(nodeA, multisigAddress)).length).toEqual(0);
        expect((await getProposedAppInstances(nodeB, multisigAddress)).length).toEqual(0);
        done();
      });

      // node B then decides to reject the proposal
      nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
        const rejectReq = constructRejectInstallRpc(msg.data.appIdentityHash, multisigAddress);
        expect((await getProposedAppInstances(nodeB, multisigAddress)).length).toEqual(1);
        proposedAppId = msg.data.appIdentityHash;
        await nodeB.rpcRouter.dispatch(rejectReq);
      });

      await makeAndSendProposeCall(nodeA, nodeB, TicTacToeApp, multisigAddress);
      expect((await getProposedAppInstances(nodeA, multisigAddress)).length).toEqual(1);
    });

    it("Node A installs, node a rejects", async (done) => {
      const multisigAddress = await createChannel(nodeA, nodeB);

      await collateralizeChannel(multisigAddress, nodeA, nodeB);

      expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
      expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);

      let proposedAppId: string;
      nodeB.on(EventNames.REJECT_INSTALL_EVENT, async (msg: RejectProposalMessage) => {
        assertMessage(msg, {
          from: nodeA.publicIdentifier,
          type: EventNames.REJECT_INSTALL_EVENT,
          data: {
            appIdentityHash: proposedAppId,
          },
        });
        expect((await getProposedAppInstances(nodeA, multisigAddress)).length).toEqual(0);
        expect((await getProposedAppInstances(nodeB, multisigAddress)).length).toEqual(0);
        done();
      });

      // node A then decides to reject the proposal
      nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
        const rejectReq = constructRejectInstallRpc(msg.data.appIdentityHash, multisigAddress);
        expect((await getProposedAppInstances(nodeB, multisigAddress)).length).toEqual(1);
        proposedAppId = msg.data.appIdentityHash;
        await nodeA.rpcRouter.dispatch(rejectReq);
      });

      await makeAndSendProposeCall(nodeA, nodeB, TicTacToeApp, multisigAddress);
    });
  });
});
