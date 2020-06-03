import {
  CONVENTION_FOR_ETH_ASSET_ID,
  EventNames,
  InstallMessage,
  ProposeMessage,
} from "@connext/types";
import { constants, utils } from "ethers";

import { CFCore } from "../../cfCore";

import { toBeLt } from "../bignumber-jest-matcher";
import { TestContractAddresses } from "../contracts";
import { setup, SetupContext } from "../setup";
import { validAction } from "../tic-tac-toe";
import {
  collateralizeChannel,
  constructTakeActionRpc,
  createChannel,
  makeInstallCall,
  makeProposeCall,
} from "../utils";

const { One } = constants;
const { parseEther } = utils;

expect.extend({ toBeLt });

jest.setTimeout(7500);

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

describe("Node method follows spec - toke action", () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;

  describe("Should be able to successfully take action on apps concurrently", () => {
    beforeEach(async () => {
      const context: SetupContext = await setup(global);
      nodeA = context["A"].node;
      nodeB = context["B"].node;

      multisigAddress = await createChannel(nodeA, nodeB);
    });

    it("can take actions on two different apps concurrently", async (done) => {
      const appIdentityHashes: string[] = [];

      await collateralizeChannel(
        multisigAddress,
        nodeA,
        nodeB,
        parseEther("2"), // We are depositing in 2 and use 1 for each concurrent app
      );

      nodeB.on("PROPOSE_INSTALL_EVENT", (msg: ProposeMessage) => {
        makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress);
      });

      nodeA.on("INSTALL_EVENT", (msg: InstallMessage) => {
        appIdentityHashes.push(msg.data.appIdentityHash);
      });

      const proposeRpc = makeProposeCall(
        nodeB,
        TicTacToeApp,
        multisigAddress,
        /* initialState */ undefined,
        One,
        CONVENTION_FOR_ETH_ASSET_ID,
        One,
        CONVENTION_FOR_ETH_ASSET_ID,
      );

      nodeA.rpcRouter.dispatch(proposeRpc);
      nodeA.rpcRouter.dispatch(proposeRpc);

      while (appIdentityHashes.length !== 2) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      let appsTakenActionOn = 0;

      nodeB.on(EventNames.UPDATE_STATE_EVENT, () => {
        appsTakenActionOn += 1;
        if (appsTakenActionOn === 2) done();
      });

      nodeA.rpcRouter.dispatch(
        constructTakeActionRpc(appIdentityHashes[0], multisigAddress, validAction),
      );
      nodeA.rpcRouter.dispatch(
        constructTakeActionRpc(appIdentityHashes[1], multisigAddress, validAction),
      );
    });
  });
});
