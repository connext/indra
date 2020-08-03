import { CONVENTION_FOR_ETH_ASSET_ID, ProposeMessage } from "@connext/types";
import { constants, utils } from "ethers";

import { CFCore } from "../../cfCore";

import { setup, SetupContext } from "../setup";
import {
  collateralizeChannel,
  createChannel,
  getContractAddresses,
  makeInstallCall,
  makeProposeCall,
} from "../utils";

const { One } = constants;
const { parseEther } = utils;

describe(`Node method follows spec - install`, () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;

  describe(
    `Node A gets app install proposal, sends to node B, B approves it, installs it, ` +
      `sends acks back to A, A installs it, both nodes have the same app instance`,
    () => {
      beforeEach(async () => {
        const context: SetupContext = await setup(global);
        nodeA = context[`A`].node;
        nodeB = context[`B`].node;

        multisigAddress = await createChannel(nodeA, nodeB);

        await collateralizeChannel(
          multisigAddress,
          nodeA,
          nodeB,
          parseEther(`2`), // We are depositing in 2 and use 1 for each concurrent app
        );
      });

      it(`install app with ETH`, async () => {
        return new Promise(async (done) => {
          const { TicTacToeApp } = getContractAddresses();

          let completedInstalls = 0;

          nodeB.on(`PROPOSE_INSTALL_EVENT`, (msg: ProposeMessage) => {
            makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress);
          });

          nodeA.on(`INSTALL_EVENT`, () => {
            completedInstalls += 1;
            if (completedInstalls === 2) {
              done();
            }
          });

          const rpc = makeProposeCall(
            nodeB,
            TicTacToeApp,
            multisigAddress,
            /* initialState */ undefined,
            One,
            CONVENTION_FOR_ETH_ASSET_ID,
            One,
            CONVENTION_FOR_ETH_ASSET_ID,
          );

          nodeA.rpcRouter.dispatch(rpc);
          nodeA.rpcRouter.dispatch(rpc);
        });
      });
    },
  );
});
