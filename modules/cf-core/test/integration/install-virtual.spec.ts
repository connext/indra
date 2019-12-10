import { Node, VIRTUAL_APP_INSTALLATION_FAIL } from "../../src";
import {
  NODE_EVENTS,
  ProposeMessage,
  InstallVirtualMessage
} from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";

import { setup, SetupContext } from "./setup";
import {
  assertNodeMessage,
  assertProposeMessage,
  collateralizeChannel,
  confirmProposedAppInstance,
  createChannel,
  getInstalledAppInstances,
  getProposedAppInstances,
  installTTTVirtual,
  makeVirtualProposal
} from "./utils";
import { One, Zero } from "ethers/constants";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../src/constants";

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

describe("Node method follows spec - proposeInstallVirtual", () => {
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
      "Virtual AppInstance with Node C. All Nodes confirm receipt of proposal",
    () => {
      it("sends proposal with non-null initial state", async done => {
        const multisigAddressAB = await createChannel(nodeA, nodeB);
        const multisigAddressBC = await createChannel(nodeB, nodeC);

        await collateralizeChannel(multisigAddressAB, nodeA, nodeB);
        await collateralizeChannel(multisigAddressBC, nodeB, nodeC);

        nodeA.once(
          NODE_EVENTS.INSTALL_VIRTUAL_EVENT,
          async (msg: InstallVirtualMessage) => {
            const [virtualAppNodeA] = await getInstalledAppInstances(nodeA);

            const [virtualAppNodeC] = await getInstalledAppInstances(nodeC);

            expect(virtualAppNodeA).toEqual(virtualAppNodeC);

            assertNodeMessage(msg, {
              from: nodeC.publicIdentifier,
              type: NODE_EVENTS.INSTALL_VIRTUAL_EVENT,
              data: {
                params: {
                  appInstanceId: virtualAppNodeA.identityHash
                }
              }
            });

            done();
          }
        );

        nodeC.once(NODE_EVENTS.PROPOSE_INSTALL_EVENT, async (msg: ProposeMessage) => {
          const { params: proposedParams } = await proposal;
          assertProposeMessage(nodeA.publicIdentifier, msg, proposedParams);
          const {
            data: { params, appInstanceId }
          } = msg;
          const [proposedAppNodeC] = await getProposedAppInstances(nodeC);

          confirmProposedAppInstance(params, proposedAppNodeC, true);

          expect(proposedAppNodeC.proposedByIdentifier).toEqual(
            nodeA.publicIdentifier
          );

          await installTTTVirtual(nodeC, appInstanceId, nodeB.publicIdentifier);
        });

        const proposal = makeVirtualProposal(nodeA, nodeC, TicTacToeApp);
        const { params } = await proposal;

        const [proposedAppNodeA] = await getProposedAppInstances(nodeA);

        confirmProposedAppInstance(params, proposedAppNodeA);
      });
    }
  );

  describe("Node A makes a virtual proposal through intermediary B to install a virtual app instance with c", () => {
    let nodeA: Node;
    let nodeB: Node;
    let nodeC: Node;

    let multisigAddressAB: string;
    let multisigAddressBC: string;

    beforeAll(async () => {
      const context: SetupContext = await setup(global, true);
      nodeA = context["A"].node;
      nodeB = context["B"].node;
      nodeC = context["C"].node;

      multisigAddressAB = await createChannel(nodeA, nodeB);
      multisigAddressBC = await createChannel(nodeB, nodeC);
    });

    it("should fail if intermediary has insufficient collateral in the channel", async done => {
      // only collateralize initiator
      await collateralizeChannel(
        multisigAddressAB,
        nodeA,
        nodeB,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        false
      );

      // proposal will not involve intermediary, install from nodeC
      nodeC.once(NODE_EVENTS.PROPOSE_INSTALL_EVENT, async (msg: ProposeMessage) => {
        const {
          data: { appInstanceId }
        } = msg;
        try {
          await installTTTVirtual(nodeC, appInstanceId, nodeB.publicIdentifier);
        } catch (e) {
          expect(
            e.message.includes(`Node Error: ${VIRTUAL_APP_INSTALLATION_FAIL}`)
          ).toBeTruthy();
        }
        done();
      });

      // try to install a virtual app with insufficient collateral
      const { params } = await makeVirtualProposal(nodeA, nodeC, TicTacToeApp);
      expect(params.initiatorDeposit.gt(Zero)).toBeTruthy();

      const [proposedAppNodeA] = await getProposedAppInstances(nodeA);

      confirmProposedAppInstance(params, proposedAppNodeA);
    });

    // FIXME: does not emit event on intermediary during virtual install
    it.skip("should emit an event on intermediaries node", async done => {
      await collateralizeChannel(multisigAddressAB, nodeA, nodeB);
      await collateralizeChannel(multisigAddressBC, nodeB, nodeC);

      // verify nodeB receives event
      nodeB.once(NODE_EVENTS.INSTALL_VIRTUAL_EVENT, () => done());

      // proposal will not involve intermediary, install from nodeC
      nodeC.once(NODE_EVENTS.PROPOSE_INSTALL_EVENT, async (msg: ProposeMessage) => {
        const {
          data: { appInstanceId }
        } = msg;
        await installTTTVirtual(nodeC, appInstanceId, nodeB.publicIdentifier);
      });

      // try to install a virtual app with insufficient collateral
      const { params } = await makeVirtualProposal(nodeA, nodeC, TicTacToeApp);
      expect(params.initiatorDeposit.gt(Zero)).toBeTruthy();

      const [proposedAppNodeA] = await getProposedAppInstances(nodeA);

      confirmProposedAppInstance(params, proposedAppNodeA);
    });
  });
});
