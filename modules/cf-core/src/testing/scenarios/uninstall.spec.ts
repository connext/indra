import { EventNames, UninstallMessage } from "@connext/types";
import { One, Two, Zero } from "ethers/constants";

import { Node } from "../../node";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";

import { toBeEq } from "../bignumber-jest-matcher";
import { NetworkContextForTestSuite } from "../contracts";
import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  collateralizeChannel,
  constructUninstallRpc,
  createChannel,
  getFreeBalanceState,
  getInstalledAppInstances,
  installApp,
} from "../utils";

expect.extend({ toBeEq });

const { TicTacToeApp } = global["network"] as NetworkContextForTestSuite;

function assertUninstallMessage(senderId: string, appIdentityHash: string, msg: UninstallMessage) {
  assertMessage(msg, {
    from: senderId,
    type: EventNames.UNINSTALL_EVENT,
    data: {
      appIdentityHash,
    },
  });
}

describe("Node A and B install apps of different outcome types, then uninstall them to test outcomes types and interpreters", () => {
  let nodeA: Node;
  let nodeB: Node;

  describe("Tests for different outcomes of the TwoPartyFixedOutcome type", () => {
    let appIdentityHash: string;
    let multisigAddress: string;
    const depositAmount = One;

    const initialState = {
      versionNumber: 0,
      winner: 2, // Hard-coded winner for test
      board: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
    };

    beforeEach(async () => {
      const context: SetupContext = await setup(global);
      nodeA = context["A"].node;
      nodeB = context["B"].node;

      multisigAddress = await createChannel(nodeA, nodeB);

      const balancesBefore = await getFreeBalanceState(nodeA, multisigAddress);

      expect(balancesBefore[nodeA.freeBalanceAddress]).toBeEq(Zero);
      expect(balancesBefore[nodeB.freeBalanceAddress]).toBeEq(Zero);

      await collateralizeChannel(multisigAddress, nodeA, nodeB, depositAmount);

      const balancesAfter = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesAfter[nodeA.freeBalanceAddress]).toBeEq(depositAmount);
      expect(balancesAfter[nodeB.freeBalanceAddress]).toBeEq(depositAmount);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects Node A to win total", async done => {
      [appIdentityHash] = await installApp(
        nodeA,
        nodeB,
        multisigAddress,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      );

      nodeB.once(EventNames.UNINSTALL_EVENT, async (msg: UninstallMessage) => {
        assertUninstallMessage(nodeA.publicIdentifier, appIdentityHash, msg);

        const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
        expect(balancesSeenByB[nodeA.freeBalanceAddress]).toBeEq(Two);
        expect(balancesSeenByB[nodeB.freeBalanceAddress]).toBeEq(Zero);
        expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
        done();
      });

      await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash));

      const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesSeenByA[nodeA.freeBalanceAddress]).toBeEq(Two);
      expect(balancesSeenByA[nodeB.freeBalanceAddress]).toBeEq(Zero);

      expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects Node B to win total", async done => {
      initialState.winner = 1;

      [appIdentityHash] = await installApp(
        nodeA,
        nodeB,
        multisigAddress,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      );

      nodeB.once(EventNames.UNINSTALL_EVENT, async (msg: UninstallMessage) => {
        assertUninstallMessage(nodeA.publicIdentifier, appIdentityHash, msg);

        const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
        expect(balancesSeenByB[nodeB.freeBalanceAddress]).toBeEq(Two);
        expect(balancesSeenByB[nodeA.freeBalanceAddress]).toBeEq(Zero);
        expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
        done();
      });

      await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash));

      const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesSeenByA[nodeB.freeBalanceAddress]).toBeEq(Two);
      expect(balancesSeenByA[nodeA.freeBalanceAddress]).toBeEq(Zero);

      expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects the funds to be split between the nodes", async done => {
      initialState.winner = 3;

      [appIdentityHash] = await installApp(
        nodeA,
        nodeB,
        multisigAddress,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      );

      nodeB.once(EventNames.UNINSTALL_EVENT, async (msg: UninstallMessage) => {
        assertUninstallMessage(nodeA.publicIdentifier, appIdentityHash, msg);

        const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
        expect(balancesSeenByB[nodeA.freeBalanceAddress]).toBeEq(depositAmount);
        expect(balancesSeenByB[nodeB.freeBalanceAddress]).toBeEq(depositAmount);
        expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
        done();
      });

      await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash));

      const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesSeenByA[nodeA.freeBalanceAddress]).toBeEq(depositAmount);
      expect(balancesSeenByA[nodeB.freeBalanceAddress]).toBeEq(depositAmount);

      expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
    });
  });
});
