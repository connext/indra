import { ChannelSigner } from "@connext/utils";
import { CONVENTION_FOR_ETH_ASSET_ID, ProposeMessage } from "@connext/types";
import { BigNumber, constants } from "ethers";

import { CFCore } from "../../cfCore";

import { MemoryLockService, MemoryMessagingService, MemoryStoreServiceFactory } from "../services";
import { A_PRIVATE_KEY, B_PRIVATE_KEY } from "../test-constants.jest";
import {
  collateralizeChannel,
  createChannel,
  getBalances,
  getContractAddresses,
  getInstalledAppInstances,
  makeInstallCall,
  makeProposeCall,
} from "../utils";
import { expect } from "../assertions";

const { One } = constants;

describe(`Uses a provided signing key generation function to sign channel state updates`, () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;

  describe(
    `Node A gets app install proposal, sends to node B, B approves it, installs it, ` +
      `sends acks back to A, A installs it, both nodes have the same app instance`,
    () => {
      beforeEach(async () => {
        const messagingService = new MemoryMessagingService();
        const lockService = new MemoryLockService();
        const storeServiceA = new MemoryStoreServiceFactory().createStoreService();
        await storeServiceA.init();

        nodeA = await CFCore.create(
          messagingService,
          storeServiceA,
          global["networks"],
          new ChannelSigner(A_PRIVATE_KEY),
          lockService,
        );

        const storeServiceB = new MemoryStoreServiceFactory().createStoreService();
        await storeServiceB.init();
        nodeB = await CFCore.create(
          messagingService,
          storeServiceB,
          global["networks"],
          new ChannelSigner(B_PRIVATE_KEY),
          lockService,
        );

        multisigAddress = await createChannel(nodeA, nodeB);
      });

      it(`install app with ETH`, async () => {
        return new Promise(async (done) => {
          await collateralizeChannel(multisigAddress, nodeA, nodeB);

          let preInstallETHBalanceNodeA: BigNumber;
          let postInstallETHBalanceNodeA: BigNumber;
          let preInstallETHBalanceNodeB: BigNumber;
          let postInstallETHBalanceNodeB: BigNumber;

          nodeB.on(`PROPOSE_INSTALL_EVENT`, async (msg: ProposeMessage) => {
            [preInstallETHBalanceNodeA, preInstallETHBalanceNodeB] = await getBalances(
              nodeA,
              nodeB,
              multisigAddress,
              CONVENTION_FOR_ETH_ASSET_ID,
            );
            makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress);
          });

          nodeA.on(`INSTALL_EVENT`, async () => {
            const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
            const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
            expect(appInstanceNodeA).to.be.ok;
            expect(appInstanceNodeA).to.deep.eq(appInstanceNodeB);

            [postInstallETHBalanceNodeA, postInstallETHBalanceNodeB] = await getBalances(
              nodeA,
              nodeB,
              multisigAddress,
              CONVENTION_FOR_ETH_ASSET_ID,
            );

            expect(postInstallETHBalanceNodeA).to.be.lt(preInstallETHBalanceNodeA);

            expect(postInstallETHBalanceNodeB).to.be.lt(preInstallETHBalanceNodeB);

            done();
          });

          nodeA.rpcRouter.dispatch(
            makeProposeCall(
              nodeB,
              getContractAddresses().TicTacToeApp,
              multisigAddress,
              undefined,
              One,
              CONVENTION_FOR_ETH_ASSET_ID,
              One,
              CONVENTION_FOR_ETH_ASSET_ID,
            ),
          );
        });
      });
    },
  );
});
