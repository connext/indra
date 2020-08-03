import { CONVENTION_FOR_ETH_ASSET_ID, EventNames, ProtocolEventMessage } from "@connext/types";
import { constants, utils } from "ethers";

import { CFCore } from "../../cfCore";
import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  collateralizeChannel,
  constructUninstallRpc,
  createChannel,
  getContractAddresses,
  getFreeBalanceState,
  getInstalledAppInstances,
  installApp,
} from "../utils";
import { expect } from "../assertions";

const { One, Two, Zero } = constants;
const { isHexString } = utils;

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
  let TicTacToeApp: string;

  beforeEach(() => {
    TicTacToeApp = getContractAddresses().TicTacToeApp;
  });

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
      expect(multisigAddress).to.be.ok;
      expect(isHexString(multisigAddress)).to.be.ok;

      const balancesBefore = await getFreeBalanceState(nodeA, multisigAddress);

      expect(balancesBefore[nodeA.signerAddress]).to.eq(Zero);
      expect(balancesBefore[nodeB.signerAddress]).to.eq(Zero);

      await collateralizeChannel(multisigAddress, nodeA, nodeB, depositAmount);

      const balancesAfter = await getFreeBalanceState(nodeA, multisigAddress);
      expect(balancesAfter[nodeA.signerAddress]).to.eq(depositAmount);
      expect(balancesAfter[nodeB.signerAddress]).to.eq(depositAmount);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects Node A to win total", async () => {
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
              expect(balancesSeenByB[nodeA.signerAddress]).to.eq(Zero);
              expect(balancesSeenByB[nodeB.signerAddress]).to.eq(Two);
              expect(await getInstalledAppInstances(nodeB, multisigAddress)).to.deep.eq([]);
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
            expect(balancesSeenByA[nodeA.signerAddress]).to.eq(Zero);
            expect(balancesSeenByA[nodeB.signerAddress]).to.eq(Two);

            expect(await getInstalledAppInstances(nodeA, multisigAddress)).to.deep.eq([]);
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
      ]);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects Node B to win total", async () => {
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
              expect(balancesSeenByB[nodeB.signerAddress]).to.eq(Zero);
              expect(balancesSeenByB[nodeA.signerAddress]).to.eq(Two);
              expect(await getInstalledAppInstances(nodeB, multisigAddress)).to.deep.eq([]);
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
            expect(balancesSeenByA[nodeB.signerAddress]).to.eq(Zero);
            expect(balancesSeenByA[nodeA.signerAddress]).to.eq(Two);

            expect(await getInstalledAppInstances(nodeA, multisigAddress)).to.deep.eq([]);
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
      ]);
    });

    it("installs an app with the TwoPartyFixedOutcome outcome and expects the funds to be split between the nodes", async () => {
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
              expect(balancesSeenByB[nodeA.signerAddress]).to.eq(depositAmount);
              expect(balancesSeenByB[nodeB.signerAddress]).to.eq(depositAmount);
              expect(await getInstalledAppInstances(nodeB, multisigAddress)).to.deep.eq([]);
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
            expect(balancesSeenByA[nodeA.signerAddress]).to.eq(depositAmount);
            expect(balancesSeenByA[nodeB.signerAddress]).to.eq(depositAmount);

            expect(await getInstalledAppInstances(nodeA, multisigAddress)).to.deep.eq([]);
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
      ]);
    });
  });
});
