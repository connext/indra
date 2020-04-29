import { CONVENTION_FOR_ETH_ASSET_ID, EventNames, UninstallMessage } from "@connext/types";
import { utils, constants } from "ethers";

import { Node } from "../../node";

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
    const depositAmount = constants.One;

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
      expect(multisigAddress).toBeTruthy();
      expect(utils.isHexString(multisigAddress)).toBeTruthy();

      const balancesBefore = await getFreeBalanceState(nodeA, multisigAddress);

      expect(balancesBefore[nodeA.signerAddress]).toBeEq(constants.Zero);
      expect(balancesBefore[nodeB.signerAddress]).toBeEq(constants.Zero);

      await collateralizeChannel(multisigAddress, nodeA, nodeB, depositAmount);

      const balancesAfter = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesAfter[nodeA.signerAddress]).toBeEq(depositAmount);
      expect(balancesAfter[nodeB.signerAddress]).toBeEq(depositAmount);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects Node A to win total", async (done) => {
      [appIdentityHash] = await installApp(
        nodeA,
        nodeB,
        multisigAddress,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_ASSET_ID,
        depositAmount,
        CONVENTION_FOR_ETH_ASSET_ID,
      );

      await Promise.all([
        new Promise(async (resolve, reject) => {
          nodeB.on(EventNames.UNINSTALL_EVENT, async (msg: UninstallMessage) => {
            if (msg.data.appIdentityHash !== appIdentityHash) {
              return;
            }
            try {
              assertUninstallMessage(nodeA.publicIdentifier, appIdentityHash, msg);

              const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
              expect(balancesSeenByB[nodeA.signerAddress]).toBeEq(constants.Two);
              expect(balancesSeenByB[nodeB.signerAddress]).toBeEq(constants.Zero);
              expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        }),
        new Promise(async (resolve, reject) => {
          try {
            await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash));

            const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
            expect(balancesSeenByA[nodeA.signerAddress]).toBeEq(constants.Two);
            expect(balancesSeenByA[nodeB.signerAddress]).toBeEq(constants.Zero);

            expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
      ]);

      done();
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects Node B to win total", async (done) => {
      initialState.winner = 1;

      [appIdentityHash] = await installApp(
        nodeA,
        nodeB,
        multisigAddress,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_ASSET_ID,
        depositAmount,
        CONVENTION_FOR_ETH_ASSET_ID,
      );

      await Promise.all([
        new Promise(async (resolve, reject) => {
          nodeB.on(EventNames.UNINSTALL_EVENT, async (msg: UninstallMessage) => {
            if (msg.data.appIdentityHash !== appIdentityHash) {
              return;
            }
            try {
              assertUninstallMessage(nodeA.publicIdentifier, appIdentityHash, msg);

              const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
              expect(balancesSeenByB[nodeB.signerAddress]).toBeEq(constants.Two);
              expect(balancesSeenByB[nodeA.signerAddress]).toBeEq(constants.Zero);
              expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        }),
        new Promise(async (resolve, reject) => {
          try {
            await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash));

            const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
            expect(balancesSeenByA[nodeB.signerAddress]).toBeEq(constants.Two);
            expect(balancesSeenByA[nodeA.signerAddress]).toBeEq(constants.Zero);

            expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
      ]);
      done();
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects the funds to be split between the nodes", async (done) => {
      initialState.winner = 3;

      [appIdentityHash] = await installApp(
        nodeA,
        nodeB,
        multisigAddress,
        TicTacToeApp,
        initialState,
        depositAmount,
        CONVENTION_FOR_ETH_ASSET_ID,
        depositAmount,
        CONVENTION_FOR_ETH_ASSET_ID,
      );

      await Promise.all([
        new Promise(async (resolve, reject) => {
          nodeB.on(EventNames.UNINSTALL_EVENT, async (msg: UninstallMessage) => {
            if (msg.data.appIdentityHash !== appIdentityHash) {
              return;
            }
            try {
              assertUninstallMessage(nodeA.publicIdentifier, appIdentityHash, msg);

              const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
              expect(balancesSeenByB[nodeA.signerAddress]).toBeEq(depositAmount);
              expect(balancesSeenByB[nodeB.signerAddress]).toBeEq(depositAmount);
              expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        }),
        new Promise(async (resolve, reject) => {
          try {
            await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash));

            const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
            expect(balancesSeenByA[nodeA.signerAddress]).toBeEq(depositAmount);
            expect(balancesSeenByA[nodeB.signerAddress]).toBeEq(depositAmount);

            expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
      ]);
      done();
    });
  });
});
