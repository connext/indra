import { EventNames, ProposeMessage } from "@connext/types";

import { CFCore } from "../../cfCore";

import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  collateralizeChannel,
  constructRejectInstallRpc,
  createChannel,
  getContractAddresses,
  getInstalledAppInstances,
  getProposedAppInstances,
  makeAndSendProposeCall,
} from "../utils";
import { expect } from "../assertions";

describe("Node method follows spec - rejectInstall", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe("Rejects proposal with non-null initial state", () => {
    it("Node A installs, node b rejects", async () => {
      return new Promise(async (done) => {
        const { TicTacToeApp } = getContractAddresses();

        const multisigAddress = await createChannel(nodeA, nodeB);

        await collateralizeChannel(multisigAddress, nodeA, nodeB);

        expect(await getInstalledAppInstances(nodeA, multisigAddress)).to.deep.eq([]);
        expect(await getInstalledAppInstances(nodeB, multisigAddress)).to.deep.eq([]);

        nodeA.on(EventNames.REJECT_INSTALL_EVENT, async (msg) => {
          assertMessage<typeof EventNames.REJECT_INSTALL_EVENT>(
            msg,
            {
              from: nodeB.publicIdentifier,
              type: EventNames.REJECT_INSTALL_EVENT,
              data: { reason: "Rejected" },
            },
            ["data.appInstance"],
          );
          expect((await getProposedAppInstances(nodeA, multisigAddress)).length).to.eq(0);
          expect((await getProposedAppInstances(nodeB, multisigAddress)).length).to.eq(0);
          done();
        });

        // node B then decides to reject the proposal
        nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
          const rejectReq = constructRejectInstallRpc(msg.data.appInstanceId, multisigAddress);
          expect((await getProposedAppInstances(nodeB, multisigAddress)).length).to.eq(1);
          await nodeB.rpcRouter.dispatch(rejectReq);
        });

        await makeAndSendProposeCall(nodeA, nodeB, TicTacToeApp, multisigAddress);
        expect((await getProposedAppInstances(nodeA, multisigAddress)).length).to.eq(1);
      });
    });

    it("Node A installs, node a rejects", async () => {
      return new Promise(async (done) => {
        const { TicTacToeApp } = getContractAddresses();
        const multisigAddress = await createChannel(nodeA, nodeB);

        await collateralizeChannel(multisigAddress, nodeA, nodeB);

        expect(await getInstalledAppInstances(nodeA, multisigAddress)).to.deep.eq([]);
        expect(await getInstalledAppInstances(nodeB, multisigAddress)).to.deep.eq([]);

        nodeB.on(EventNames.REJECT_INSTALL_EVENT, async (msg) => {
          assertMessage<typeof EventNames.REJECT_INSTALL_EVENT>(
            msg,
            {
              from: nodeA.publicIdentifier,
              type: EventNames.REJECT_INSTALL_EVENT,
              data: { reason: "Rejected" },
            },
            ["data.appInstance"],
          );
          expect((await getProposedAppInstances(nodeA, multisigAddress)).length).to.eq(0);
          expect((await getProposedAppInstances(nodeB, multisigAddress)).length).to.eq(0);
          done();
        });

        // node A then decides to reject the proposal
        nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
          const rejectReq = constructRejectInstallRpc(msg.data.appInstanceId, multisigAddress);
          expect((await getProposedAppInstances(nodeB, multisigAddress)).length).to.eq(1);
          await nodeA.rpcRouter.dispatch(rejectReq);
        });

        await makeAndSendProposeCall(nodeA, nodeB, TicTacToeApp, multisigAddress);
      });
    });
  });
});
