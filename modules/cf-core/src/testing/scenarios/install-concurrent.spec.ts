import { CONVENTION_FOR_ETH_ASSET_ID, ProposeMessage } from "@connext/types";
import { One } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { Node } from "../../node";

import { toBeLt } from "../bignumber-jest-matcher";
import { TestContractAddresses } from "../contracts";
import { setup, SetupContext } from "../setup";
import {
  collateralizeChannel,
  createChannel,
  makeInstallCall,
  makeProposeCall,
} from "../utils";

expect.extend({ toBeLt });

jest.setTimeout(7500);

const { TicTacToeApp } = global[`contracts`] as TestContractAddresses;

describe(`Node method follows spec - install`, () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;

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

      it(`install app with ETH`, done => {
        let completedInstalls = 0;

        nodeB.on(`PROPOSE_INSTALL_EVENT`, (msg: ProposeMessage) => {
          makeInstallCall(nodeB, msg.data.appIdentityHash);
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
    },
  );
});
