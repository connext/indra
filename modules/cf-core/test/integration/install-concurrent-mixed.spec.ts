import { One } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { Node } from "../../src";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../src/constants";
import { ProposeMessage } from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";
import { toBeLt } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import {
  collateralizeChannel,
  constructVirtualProposalRpc,
  createChannel,
  getAppContext,
  installTTTVirtual,
  makeInstallCall,
  makeProposeCall
} from "./utils";

expect.extend({ toBeLt });

jest.setTimeout(15000);

const { TicTacToeApp } = global[`networkContext`] as NetworkContextForTestSuite;

describe(`Concurrently installing virtual and regular applications without issue`, () => {
  let multisigAddressAB: string;
  let multisigAddressBC: string;
  let nodeA: Node;
  let nodeB: Node;
  let nodeC: Node;

  beforeEach(async () => {
    const context: SetupContext = await setup(global, true);
    nodeA = context[`A`].node;
    nodeB = context[`B`].node;
    nodeC = context[`C`].node;

    multisigAddressAB = await createChannel(nodeA, nodeB);
    multisigAddressBC = await createChannel(nodeB, nodeC);

    await collateralizeChannel(
      multisigAddressAB,
      nodeA,
      nodeB,
      parseEther(`2`)
    );

    await collateralizeChannel(
      multisigAddressBC,
      nodeB,
      nodeC,
      parseEther(`2`)
    );
  });

  it(`can handle a virtual and regular concurrent TTT app install`, async done => {
    let completedInstalls = 0;
    nodeB.on(`PROPOSE_INSTALL_EVENT`, (msg: ProposeMessage) => {
      makeInstallCall(nodeB, msg.data.appInstanceId);
    });

    nodeC.on(`PROPOSE_INSTALL_EVENT`, (msg: ProposeMessage) => {
      installTTTVirtual(nodeC, msg.data.appInstanceId, nodeB.publicIdentifier);
    });

    nodeA.on(`INSTALL_EVENT`, () => {
      completedInstalls += 1;
      if (completedInstalls === 2) done();
    });

    nodeA.on(`INSTALL_VIRTUAL_EVENT`, () => {
      completedInstalls += 1;
      if (completedInstalls === 2) done();
    });

    const proposeRpc = makeProposeCall(
      nodeB,
      TicTacToeApp,
      /* initialState */ undefined,
      One,
      CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      One,
      CONVENTION_FOR_ETH_TOKEN_ADDRESS
    );

    const makeVirtualProposalRpc = () => {
      const appContext = getAppContext(TicTacToeApp);

      return constructVirtualProposalRpc(
        nodeC.publicIdentifier,
        appContext.appDefinition,
        appContext.abiEncodings,
        appContext.initialState,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        One,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS
      );
    };

    nodeA.rpcRouter.dispatch(proposeRpc);
    nodeA.rpcRouter.dispatch(makeVirtualProposalRpc());
  });
});
