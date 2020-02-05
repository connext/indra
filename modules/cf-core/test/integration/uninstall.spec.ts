import { AppInstanceJson } from "@connext/types";
import { One, Two, Zero } from "ethers/constants";

import { Node, USE_RESCIND_DEPOSIT_RIGHTS } from "../../src";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../src/constants";
import { UninstallMessage } from "../../src/types";
import { NetworkContextForTestSuite } from "../contracts";
import { toBeEq } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import {
  assertNodeMessage,
  collateralizeChannel,
  constructUninstallRpc,
  createChannel,
  getFreeBalanceState,
  getInstalledAppInstances,
  installApp,
  getApps,
  requestDepositRights
} from "./utils";

expect.extend({ toBeEq });

const { TicTacToeApp } = global["networkContext"] as NetworkContextForTestSuite;

function assertUninstallMessage(
  senderId: string,
  appInstanceId: string,
  msg: UninstallMessage
) {
  assertNodeMessage(msg, {
    from: senderId,
    type: "UNINSTALL_EVENT",
    data: {
      appInstanceId
    }
  });
}

describe("Uninstalling coin balance refund app", () => {
  let nodeA: Node;
  let nodeB: Node;

  let multisigAddress: string;
  let coinBalanceAppId: string;

  const assertAppsPresent = async (expected: number) => {
    const appsA = await getApps(nodeA);
    const appsB = await getApps(nodeB);
    expect(appsA.length).toEqual(expected);
    expect(appsB.length).toEqual(expected);
    return appsA.map((app: AppInstanceJson) => app.identityHash);
  };

  beforeAll(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;

    multisigAddress = await createChannel(nodeA, nodeB);

    await requestDepositRights(nodeA, multisigAddress);
    [coinBalanceAppId] = await assertAppsPresent(1);
  });

  // will timeout if it goes through this path, params are incorrect
  it("should fail if you trying to uninstall coin balance refund app", async () => {
    await expect(
      nodeB.rpcRouter.dispatch(constructUninstallRpc(coinBalanceAppId))
    ).rejects.toThrowError(USE_RESCIND_DEPOSIT_RIGHTS);
    await assertAppsPresent(1);
  });
});

describe("Node A and B install apps of different outcome types, then uninstall them to test outcomes types and interpreters", () => {
  let nodeA: Node;
  let nodeB: Node;

  describe("Tests for different outcomes of the TwoPartyFixedOutcome type", () => {
    let appInstanceId: string;
    let multisigAddress: string;
    const depositAmount = One;

    const initialState = {
      versionNumber: 0,
      winner: 2, // Hard-coded winner for test
      board: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ]
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
      [appInstanceId] = await installApp(
        nodeA,
        nodeB,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS
      );

      nodeB.once("UNINSTALL_EVENT", async (msg: UninstallMessage) => {
        assertUninstallMessage(nodeA.publicIdentifier, appInstanceId, msg);

        const balancesSeenByB = await getFreeBalanceState(
          nodeB,
          multisigAddress
        );
        expect(balancesSeenByB[nodeA.freeBalanceAddress]).toBeEq(Two);
        expect(balancesSeenByB[nodeB.freeBalanceAddress]).toBeEq(Zero);
        expect(await getInstalledAppInstances(nodeB)).toEqual([]);
        done();
      });

      await nodeA.rpcRouter.dispatch(constructUninstallRpc(appInstanceId));

      const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesSeenByA[nodeA.freeBalanceAddress]).toBeEq(Two);
      expect(balancesSeenByA[nodeB.freeBalanceAddress]).toBeEq(Zero);

      expect(await getInstalledAppInstances(nodeA)).toEqual([]);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects Node B to win total", async done => {
      initialState.winner = 1;

      [appInstanceId] = await installApp(
        nodeA,
        nodeB,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS
      );

      nodeB.once("UNINSTALL_EVENT", async (msg: UninstallMessage) => {
        assertUninstallMessage(nodeA.publicIdentifier, appInstanceId, msg);

        const balancesSeenByB = await getFreeBalanceState(
          nodeB,
          multisigAddress
        );
        expect(balancesSeenByB[nodeB.freeBalanceAddress]).toBeEq(Two);
        expect(balancesSeenByB[nodeA.freeBalanceAddress]).toBeEq(Zero);
        expect(await getInstalledAppInstances(nodeB)).toEqual([]);
        done();
      });

      await nodeA.rpcRouter.dispatch(constructUninstallRpc(appInstanceId));

      const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesSeenByA[nodeB.freeBalanceAddress]).toBeEq(Two);
      expect(balancesSeenByA[nodeA.freeBalanceAddress]).toBeEq(Zero);

      expect(await getInstalledAppInstances(nodeA)).toEqual([]);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects the funds to be split between the nodes", async done => {
      initialState.winner = 3;

      [appInstanceId] = await installApp(
        nodeA,
        nodeB,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
        depositAmount,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS
      );

      nodeB.once("UNINSTALL_EVENT", async (msg: UninstallMessage) => {
        assertUninstallMessage(nodeA.publicIdentifier, appInstanceId, msg);

        const balancesSeenByB = await getFreeBalanceState(
          nodeB,
          multisigAddress
        );
        expect(balancesSeenByB[nodeA.freeBalanceAddress]).toBeEq(depositAmount);
        expect(balancesSeenByB[nodeB.freeBalanceAddress]).toBeEq(depositAmount);
        expect(await getInstalledAppInstances(nodeB)).toEqual([]);
        done();
      });

      await nodeA.rpcRouter.dispatch(constructUninstallRpc(appInstanceId));

      const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesSeenByA[nodeA.freeBalanceAddress]).toBeEq(depositAmount);
      expect(balancesSeenByA[nodeB.freeBalanceAddress]).toBeEq(depositAmount);

      expect(await getInstalledAppInstances(nodeA)).toEqual([]);
    });
  });
});
