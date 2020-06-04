import { CONVENTION_FOR_ETH_ASSET_ID, EventNames, ProtocolEventMessage } from "@connext/types";
import { constants, utils } from "ethers";

import { CFCore } from "../../cfCore";

import { toBeEq } from "../bignumber-jest-matcher";
import { TestContractAddresses } from "../contracts";
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

const { One, Two, Zero } = constants;
const { isHexString } = utils;

expect.extend({ toBeEq });

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

function assertUninstallMessage(
  senderId: string,
  multisigAddress: string,
  appIdentityHash: string,
  msg: ProtocolEventMessage<"UNINSTALL_EVENT">,
) {
  assertMessage<typeof EventNames.UNINSTALL_EVENT>(msg, {
    from: senderId,
    type: EventNames.UNINSTALL_EVENT,
    data: {
      appIdentityHash,
      multisigAddress,
    },
  });
}

describe("Node A and B install apps of different outcome types, then uninstall them to test outcomes types and interpreters", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  describe("Tests for different outcomes of the TwoPartyFixedOutcome type", () => {
    let appIdentityHash: string;
    let multisigAddress: string;
    const depositAmount = One;

    const initialState = {
      versionNumber: 1,
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
      expect(isHexString(multisigAddress)).toBeTruthy();

      const balancesBefore = await getFreeBalanceState(nodeA, multisigAddress);

      expect(balancesBefore[nodeA.signerAddress]).toBeEq(Zero);
      expect(balancesBefore[nodeB.signerAddress]).toBeEq(Zero);

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
          nodeB.on(EventNames.UNINSTALL_EVENT, async (msg) => {
            if (msg.data.appIdentityHash !== appIdentityHash) {
              return;
            }
            try {
              assertUninstallMessage(nodeA.publicIdentifier, multisigAddress, appIdentityHash, msg);

              const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
              expect(balancesSeenByB[nodeA.signerAddress]).toBeEq(Zero);
              expect(balancesSeenByB[nodeB.signerAddress]).toBeEq(Two);
              expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        }),
        new Promise(async (resolve, reject) => {
          try {
            await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash, multisigAddress));

            const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
            expect(balancesSeenByA[nodeA.signerAddress]).toBeEq(Zero);
            expect(balancesSeenByA[nodeB.signerAddress]).toBeEq(Two);

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
          nodeB.on(EventNames.UNINSTALL_EVENT, async (msg) => {
            if (msg.data.appIdentityHash !== appIdentityHash) {
              return;
            }
            try {
              assertUninstallMessage(nodeA.publicIdentifier, multisigAddress, appIdentityHash, msg);

              const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
              expect(balancesSeenByB[nodeB.signerAddress]).toBeEq(Zero);
              expect(balancesSeenByB[nodeA.signerAddress]).toBeEq(Two);
              expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        }),
        new Promise(async (resolve, reject) => {
          try {
            await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash, multisigAddress));

            const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
            expect(balancesSeenByA[nodeB.signerAddress]).toBeEq(Zero);
            expect(balancesSeenByA[nodeA.signerAddress]).toBeEq(Two);

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
          nodeB.on(EventNames.UNINSTALL_EVENT, async (msg) => {
            if (msg.data.appIdentityHash !== appIdentityHash) {
              return;
            }
            try {
              assertUninstallMessage(nodeA.publicIdentifier, multisigAddress, appIdentityHash, msg);

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
            await nodeA.rpcRouter.dispatch(constructUninstallRpc(appIdentityHash, multisigAddress));

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
